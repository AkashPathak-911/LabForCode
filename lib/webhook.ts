import { Submission } from "@/lib/database";

export async function sendWebhook(submission: Submission) {
  if (!submission.callback_url) return;

  try {
    const response = await fetch(submission.callback_url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      console.error(
        `Webhook failed for submission ${submission.token}: ${response.status} ${response.statusText}`
      );
    } else {
      console.log(
        `Webhook sent successfully for submission ${submission.token}`
      );
    }
  } catch (error) {
    console.error(`Webhook error for submission ${submission.token}:`, error);
  }
}

export async function sendBatchWebhooks(submissions: Submission[]) {
  const webhookPromises = submissions
    .filter((sub) => sub.callback_url)
    .map(sendWebhook);

  await Promise.allSettled(webhookPromises);
}
