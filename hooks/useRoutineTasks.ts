"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase/client";
import type { Chore } from "@/types";

export type RoutineTask = Chore & {
  createdAt: string;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function normalizeTask(
  taskId: string,
  task: Partial<RoutineTask> | undefined,
  fallbackDateKey: string,
): RoutineTask {
  return {
    id: task?.id ?? taskId,
    title: task?.title ?? "Untitled task",
    ownerId: task?.ownerId ?? "family",
    done: Boolean(task?.done),
    dueDate: task?.dueDate ?? fallbackDateKey,
    createdAt:
      typeof task?.createdAt === "string"
        ? task.createdAt
        : new Date(0).toISOString(),
  };
}

export function useRoutineTasks(dateKey: string, defaultTasks: RoutineTask[]) {
  const [tasks, setTasks] = useState<RoutineTask[]>(defaultTasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dayRef = useMemo(() => doc(firebaseDb, "routineDays", dateKey), [dateKey]);
  const tasksRef = useMemo(
    () => collection(firebaseDb, "routineDays", dateKey, "tasks"),
    [dateKey],
  );

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    async function ensureDayInitialized() {
      const daySnapshot = await getDoc(dayRef);
      if (daySnapshot.exists()) return;

      await runTransaction(firebaseDb, async (transaction) => {
        const currentDay = await transaction.get(dayRef);
        if (currentDay.exists()) return;

        transaction.set(dayRef, {
          initializedAt: serverTimestamp(),
          dateKey,
        });

        for (const task of defaultTasks) {
          const taskRef = doc(tasksRef, task.id);
          transaction.set(taskRef, {
            ...task,
            dueDate: task.dueDate ?? dateKey,
          });
        }
      });
    }

    void ensureDayInitialized().catch((caughtError) => {
      if (ignore) return;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load routine tasks.",
      );
    });

    const unsubscribe = onSnapshot(
      query(tasksRef, orderBy("createdAt", "asc")),
      (snapshot) => {
        if (ignore) return;
        const nextTasks = snapshot.docs.map((taskDoc) =>
          normalizeTask(
            taskDoc.id,
            taskDoc.data() as Partial<RoutineTask>,
            dateKey,
          ),
        );

        setTasks(nextTasks);
        setLoading(false);
        setError(null);
      },
      (caughtError) => {
        if (ignore) return;
        setLoading(false);
        setError(caughtError.message);
      },
    );

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [dateKey, dayRef, defaultTasks, tasksRef]);

  async function addTask(title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const id = createId("task");
    await setDoc(doc(tasksRef, id), {
      id,
      title: trimmedTitle,
      ownerId: "family",
      done: false,
      dueDate: dateKey,
      createdAt: new Date().toISOString(),
    });
  }

  async function toggleTask(taskId: string) {
    const existingTask = tasks.find((task) => task.id === taskId);
    if (!existingTask) return;

    await setDoc(
      doc(tasksRef, taskId),
      { ...existingTask, done: !existingTask.done },
      { merge: true },
    );
  }

  async function deleteTask(taskId: string) {
    const batch = writeBatch(firebaseDb);
    batch.delete(doc(tasksRef, taskId));
    await batch.commit();
  }

  async function resetTasks() {
    const batch = writeBatch(firebaseDb);

    for (const task of tasks) {
      batch.delete(doc(tasksRef, task.id));
    }

    batch.set(
      dayRef,
      {
        initializedAt: serverTimestamp(),
        dateKey,
        resetAt: serverTimestamp(),
      },
      { merge: true },
    );

    for (const task of defaultTasks) {
      batch.set(doc(tasksRef, task.id), {
        ...task,
        done: false,
        dueDate: task.dueDate ?? dateKey,
      });
    }

    await batch.commit();
  }

  return {
    tasks,
    loading,
    error,
    addTask,
    toggleTask,
    deleteTask,
    resetTasks,
  };
}
