import { AccountId, Client, PrivateKey, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const topicId = process.env.HEDERA_RECEIPT_TOPIC_ID;
  if (!accountId || !privateKey || !topicId) return NextResponse.json({ error: "Configure HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and HEDERA_RECEIPT_TOPIC_ID" }, { status: 503 });
  const body = await request.json();
  if (!body.invoiceId || !body.txId) return NextResponse.json({ error: "invoiceId and txId are required" }, { status: 400 });
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(accountId), PrivateKey.fromString(privateKey));
  try {
    const response = await new TopicMessageSubmitTransaction({ topicId, message: JSON.stringify({ source: "saucerpay", invoiceId: body.invoiceId, txId: body.txId, timestamp: new Date().toISOString() }) }).execute(client);
    const receipt = await response.getReceipt(client);
    return NextResponse.json({ topicId, sequence: receipt.topicSequenceNumber?.toString(), transactionId: response.transactionId.toString() });
  } finally {
    client.close();
  }
}
