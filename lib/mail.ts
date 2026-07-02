import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin-core";
import { serverConfig } from "@/lib/config";

export async function queueTransactionalEmail(input: {
  to: string[];
  subject: string;
  html: string;
}) {
  await getFirebaseAdminDb().collection(serverConfig.firebaseMailCollection).add({
    to: input.to,
    message: {
      subject: input.subject,
      html: input.html,
    },
  });
}
