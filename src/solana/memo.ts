import {
  Connection,
  Transaction,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { getConnectedAddress, getWalletProvider } from "./wallet";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export async function broadcastScriptureMemo(
  scriptureRef: string,
): Promise<string> {
  const provider = getWalletProvider();
  if (!provider) throw new Error("No wallet provider available.");

  let publicKey = getConnectedAddress();
  if (!publicKey) {
    const result = await provider.connect();
    publicKey = result.publicKey.toString();
  }

  const memoText = `RB1:save:${scriptureRef}`;
  const connection = getConnection();

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText),
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = new PublicKey(publicKey);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  console.log("[SolanaMemo] Preparing memo transaction:", {
    memo: memoText,
    feePayer: publicKey,
    blockhash,
  });

  // Primary path: signTransaction + sendRawTransaction (most compatible across wallets)
  if (typeof provider.signTransaction === "function") {
    const signed = await provider.signTransaction(transaction);
    console.log("[SolanaMemo] Transaction signed by wallet");

    const raw = (signed as Transaction).serialize();
    const signature = await connection.sendRawTransaction(raw, {
      maxRetries: 3,
      skipPreflight: false,
    });
    console.log("[SolanaMemo] Raw transaction sent:", signature);

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    console.log("[SolanaMemo] Transaction confirmed:", signature);
    return signature;
  }

  // Fallback: signAndSendTransaction (wallet handles submission)
  if (typeof provider.signAndSendTransaction === "function") {
    console.log("[SolanaMemo] Using signAndSendTransaction fallback");
    const result = await provider.signAndSendTransaction(transaction);
    // Wallets return either a string signature or { signature: string }
    const signature =
      typeof result === "string"
        ? result
        : (result as { signature: string }).signature;
    if (!signature)
      throw new Error("Wallet did not return a transaction signature.");

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return signature;
  }

  throw new Error("Wallet does not support transaction signing.");
}
