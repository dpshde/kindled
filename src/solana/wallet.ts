import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { Transaction } from "@solana/web3.js";

export interface WalletProvider {
  publicKey?: { toString(): string } | null;
  isPhantom?: boolean;
  isSolflare?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string };
  }>;
  disconnect?(): Promise<void>;
  signAndSendTransaction?(
    tx: unknown,
    opts?: { maxRetries?: number },
  ): Promise<{ signature: string }>;
  signTransaction?(tx: unknown): Promise<unknown>;
}

export interface WalletInfo {
  name: string;
  icon: string;
  provider: WalletProvider;
}

// ---------------------------------------------------------------------------
// Legacy provider detection (backwards compatible with pre-standard wallets)
// ---------------------------------------------------------------------------

function getLegacyProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;

  const phantom = (w.phantom as Record<string, unknown> | undefined)?.solana as
    | WalletProvider
    | undefined;
  if (phantom) return phantom;

  const solflare = w.solflare as WalletProvider | undefined;
  if (solflare) return solflare;

  // Generic fallback: scan globals for anything that looks like a wallet
  for (const key of Object.keys(w)) {
    if (key === "navigator" || key === "window" || key === "document") continue;
    const candidate = w[key];
    if (
      candidate &&
      typeof candidate === "object" &&
      "connect" in candidate &&
      ("signTransaction" in candidate || "signAndSendTransaction" in candidate)
    ) {
      const provider = candidate as WalletProvider;
      if (provider.publicKey || provider.isPhantom || provider.isSolflare) {
        return provider;
      }
    }
  }

  return null;
}

function getLegacyWalletInfo(): WalletInfo | null {
  const provider = getLegacyProvider();
  if (!provider) return null;

  let name = "Wallet";
  if (provider.isPhantom) name = "Phantom";
  else if (provider.isSolflare) name = "Solflare";

  return { name, icon: "", provider };
}

// ---------------------------------------------------------------------------
// Wallet Standard provider wrapper
// ---------------------------------------------------------------------------

type ConnectFeature = {
  "standard:connect": { connect(): Promise<void> };
};

type SignTransactionFeature = {
  "solana:signTransaction": {
    signTransaction(inputs: {
      transaction: Uint8Array;
      account: WalletAccount;
      chain?: string;
    }): Promise<{ signedTransaction: Uint8Array }>;
  };
};

type SignAndSendFeature = {
  "solana:signAndSendTransaction": {
    signAndSendTransaction(inputs: {
      transaction: Uint8Array;
      account: WalletAccount;
      chain?: string;
      options?: { maxRetries?: number };
    }): Promise<{ signature: string }>;
  };
};

function findStandardSolanaWallets(): Array<{
  wallet: Wallet;
  account?: WalletAccount;
}> {
  const results: Array<{ wallet: Wallet; account?: WalletAccount }> = [];
  if (typeof window === "undefined") return results;
  try {
    const wallets = getWallets().get();
    for (const wallet of wallets) {
      try {
        // Some wallets may not populate wallet.chains or wallet.accounts
        // correctly. Use Array.isArray to guard against malformed providers.
        const walletChains = (wallet as any).chains;
        const walletAccounts = (wallet as any).accounts;
        const hasSolanaWalletChain =
          Array.isArray(walletChains) &&
          walletChains.some((c: string) => c.startsWith("solana:"));
        const solanaAccount = Array.isArray(walletAccounts)
          ? walletAccounts.find((a: WalletAccount) => {
              const accountChains = (a as any).chains;
              return (
                Array.isArray(accountChains) &&
                accountChains.some((c: string) => c.startsWith("solana:"))
              );
            })
          : undefined;
        if (hasSolanaWalletChain || solanaAccount) {
          results.push({ wallet, account: solanaAccount });
        }
      } catch {
        // Skip malformed wallet
      }
    }
  } catch {
    // Wallet Standard not supported
  }
  return results;
}

// Kept for backward compatibility — returns the first available standard wallet
function findStandardSolanaWallet(): {
  wallet: Wallet;
  account?: WalletAccount;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const wallets = getWallets().get();
    for (const wallet of wallets) {
      try {
        const walletChains = (wallet as any).chains;
        const walletAccounts = (wallet as any).accounts;
        const hasSolanaWalletChain =
          Array.isArray(walletChains) &&
          walletChains.some((c: string) => c.startsWith("solana:"));
        const solanaAccount = Array.isArray(walletAccounts)
          ? walletAccounts.find((a: WalletAccount) => {
              const accountChains = (a as any).chains;
              return (
                Array.isArray(accountChains) &&
                accountChains.some((c: string) => c.startsWith("solana:"))
              );
            })
          : undefined;
        if (hasSolanaWalletChain || solanaAccount) {
          return { wallet, account: solanaAccount };
        }
      } catch {
        // Skip malformed wallet
      }
    }
  } catch {
    // Wallet Standard not supported
  }
  return null;
}

function wrapStandardWallet(
  wallet: Wallet,
  initialAccount?: WalletAccount,
): WalletProvider | null {
  const features = wallet.features as unknown as ConnectFeature &
    Partial<SignTransactionFeature> &
    Partial<SignAndSendFeature>;

  const hasConnect = "standard:connect" in features;
  const hasSignTx = "solana:signTransaction" in features;
  const hasSignSend = "solana:signAndSendTransaction" in features;

  if (!hasConnect || (!hasSignTx && !hasSignSend)) return null;

  let currentAccount = initialAccount;

  const getAccount = (): WalletAccount => {
    const account =
      currentAccount ??
      wallet.accounts.find((a) =>
        a.chains.some((c) => c.startsWith("solana:")),
      );
    if (!account) throw new Error("No Solana account available");
    return account;
  };

  const getSolanaChain = () =>
    getAccount().chains.find((c) => c.startsWith("solana:"));

  const provider: WalletProvider = {
    publicKey: currentAccount
      ? { toString: () => currentAccount!.address }
      : null,

    async connect(_opts) {
      await features["standard:connect"].connect();

      // Re-read accounts after the user approves the connection
      const authorized = wallet.accounts.find((a) =>
        a.chains.some((c) => c.startsWith("solana:")),
      );
      if (!authorized) {
        throw new Error("Wallet did not authorize any Solana account");
      }
      currentAccount = authorized;

      return { publicKey: { toString: () => currentAccount!.address } };
    },
  };

  if (hasSignTx) {
    provider.signTransaction = async (tx) => {
      const transaction = tx as Transaction;
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const { signedTransaction } = await features[
        "solana:signTransaction"
      ]!.signTransaction({
        transaction: serialized,
        account: getAccount(),
        chain: getSolanaChain(),
      });
      return Transaction.from(signedTransaction);
    };
  }

  if (hasSignSend) {
    provider.signAndSendTransaction = async (tx, opts) => {
      const transaction = tx as Transaction;
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const result = await features[
        "solana:signAndSendTransaction"
      ]!.signAndSendTransaction({
        transaction: serialized,
        account: getAccount(),
        chain: getSolanaChain(),
        options: opts,
      });
      return { signature: result.signature };
    };
  }

  return provider;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAvailableWallets(): WalletInfo[] {
  const wallets: WalletInfo[] = [];

  // Standard wallets
  const standard = findStandardSolanaWallets();
  for (const { wallet, account } of standard) {
    const wrapped = wrapStandardWallet(wallet, account);
    if (wrapped) {
      wallets.push({
        name: wallet.name,
        icon: wallet.icon,
        provider: wrapped,
      });
    }
  }

  // Legacy wallets (only add if not already covered by standard)
  const legacy = getLegacyWalletInfo();
  if (legacy) {
    const hasSameName = wallets.some(
      (w) => w.name.toLowerCase() === legacy.name.toLowerCase(),
    );
    if (!hasSameName) {
      wallets.push(legacy);
    }
  }

  return wallets;
}

export function waitForWallets(timeoutMs = 2000): Promise<WalletInfo[]> {
  return new Promise((resolve) => {
    const found = getAvailableWallets();
    if (found.length > 0) {
      resolve(found);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    try {
      const wallets = getWallets();
      unsubscribe = wallets.on("register", () => {
        const updated = getAvailableWallets();
        if (updated.length > 0) {
          unsubscribe?.();
          clearTimeout(timer);
          resolve(updated);
        }
      });
    } catch {
      // Wallet Standard not available
    }

    const timer = setTimeout(() => {
      unsubscribe?.();
      resolve(getAvailableWallets());
    }, timeoutMs);
  });
}

export const WALLET_INSTALL_LINKS: Array<{ name: string; url: string }> = [
  { name: "Phantom", url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app" },
];

export function getWalletProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;

  const standard = findStandardSolanaWallet();
  if (standard) {
    const wrapped = wrapStandardWallet(standard.wallet, standard.account);
    if (wrapped) return wrapped;
  }

  return getLegacyProvider();
}

const MANUAL_DISCONNECT_KEY = "kindled.wallet_manual_disconnect";

function isManuallyDisconnected(): boolean {
  try {
    return localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1";
  } catch {
    return false;
  }
}

function setManuallyDisconnected(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(MANUAL_DISCONNECT_KEY, "1");
    } else {
      localStorage.removeItem(MANUAL_DISCONNECT_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function isWalletAvailable(): boolean {
  return getWalletProvider() !== null;
}

export async function connectWallet(
  provider?: WalletProvider,
): Promise<string> {
  const p = provider ?? getWalletProvider();
  if (!p) {
    throw new Error(
      "No Solana wallet found. Please install a compatible wallet extension.",
    );
  }
  try {
    const result = await p.connect();
    setManuallyDisconnected(false);
    return result.publicKey.toString();
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Wallet connection rejected.",
    );
  }
}

export function getConnectedAddress(): string | null {
  if (isManuallyDisconnected()) return null;
  const provider = getWalletProvider();
  return provider?.publicKey?.toString() ?? null;
}

type DisconnectFeature = {
  "standard:disconnect": { disconnect(): Promise<void> };
};

export async function disconnectWallet(): Promise<void> {
  // Standard wallets
  const standard = findStandardSolanaWallet();
  if (standard) {
    const features = standard.wallet
      .features as unknown as Partial<DisconnectFeature>;
    const disconnectFeature = features["standard:disconnect"];
    if (disconnectFeature) {
      try {
        await disconnectFeature.disconnect();
      } catch (err) {
        console.error("[Wallet] Standard disconnect failed:", err);
      }
    }
  }

  // Legacy wallets — some expose a disconnect() method
  const legacy = getLegacyProvider();
  if (legacy && typeof legacy.disconnect === "function") {
    try {
      await legacy.disconnect();
    } catch (err) {
      console.error("[Wallet] Legacy disconnect failed:", err);
    }
  }

  // Remember the user's choice so we don't auto-reconnect on reload
  setManuallyDisconnected(true);
}
