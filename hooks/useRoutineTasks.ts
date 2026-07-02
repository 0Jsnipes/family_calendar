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
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
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
  const [loading, setLoading] = useState(isFirebaseClientConfigured());
  const [error, setError] = useState<string | null>(
    isFirebaseClientConfigured() ? null : "Firebase client env vars are missing.",
  );

  const dayRef = useMemo(
    () =>
      isFirebaseClientConfigured()
        ? doc(getFirebaseDb(), "routineDays", dateKey)
        : null,
    [dateKey],
  );
  const tasksRef = useMemo(
    () =>
      isFirebaseClientConfigured()
        ? collection(getFirebaseDb(), "routineDays", dateKey, "tasks")
        : null,
    [dateKey],
  );

  useEffect(() => {
    if (!dayRef || !tasksRef) {
      const timeoutId = window.setTimeout(() => {
        setTasks(defaultTasks);
        setLoading(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const currentDayRef = dayRef;
    const currentTasksRef = tasksRef;

    let ignore = false;
    const loadingTimeoutId = window.setTimeout(() => {
      if (!ignore) {
        setLoading(true);
      }
    }, 0);

    async function ensureDayInitialized() {
      const daySnapshot = await getDoc(currentDayRef);
      if (daySnapshot.exists()) return;

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const currentDay = await transaction.get(currentDayRef);
        if (currentDay.exists()) return;

        transaction.set(currentDayRef, {
          initializedAt: serverTimestamp(),
          dateKey,
        });

        for (const task of defaultTasks) {
          const taskRef = doc(currentTasksRef, task.id);
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
      query(currentTasksRef, orderBy("createdAt", "asc")),
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
      window.clearTimeout(loadingTimeoutId);
      unsubscribe();
    };
  }, [dateKey, dayRef, defaultTasks, tasksRef]);

  async function addTask(title: string) {
    if (!tasksRef) throw new Error("Firebase client env vars are missing.");
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
    if (!tasksRef) throw new Error("Firebase client env vars are missing.");
    const existingTask = tasks.find((task) => task.id === taskId);
    if (!existingTask) return;

    await setDoc(
      doc(tasksRef, taskId),
      { ...existingTask, done: !existingTask.done },
      { merge: true },
    );
  }

  async function deleteTask(taskId: string) {
    if (!tasksRef) throw new Error("Firebase client env vars are missing.");
    const batch = writeBatch(getFirebaseDb());
    batch.delete(doc(tasksRef, taskId));
    await batch.commit();
  }

  async function resetTasks() {
    if (!dayRef || !tasksRef) {
      throw new Error("Firebase client env vars are missing.");
    }
    const batch = writeBatch(getFirebaseDb());

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
