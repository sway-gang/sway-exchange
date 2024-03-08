import { ethers, JsonRpcSigner, NonceManager } from "ethers";
import { makeAutoObservable } from "mobx";
import { Nullable } from "tsdef";

import { NETWORK_ERROR, NetworkError } from "../NetworkError";

import { Network, PROVIDERS, TOKENS_BY_ASSET_ID, web3Modal } from "./constants";

export class WalletManager {
  public address: Nullable<string> = null;
  public signer: Nullable<ethers.JsonRpcSigner> = null;
  public privateKey: Nullable<string> = null;

  public isRemoteProvider = false;

  constructor() {
    makeAutoObservable(this);

    web3Modal.subscribeProvider((newProvider) => {
      // Way to handle remote wallet
      if (newProvider.providerType === "walletConnect") {
        this.isRemoteProvider = true;
        return;
      }

      this.isRemoteProvider = false;
    });
  }

  connect = async (targetNetwork: Network): Promise<void> => {
    const walletProvider = web3Modal.getWalletProvider();

    if (!walletProvider) {
      throw new NetworkError(NETWORK_ERROR.INVALID_WALLET_PROVIDER);
    }

    this.signer = await new ethers.BrowserProvider(walletProvider).getSigner();
    const address = await this.signer.getAddress();

    this.address = address;
  };

  connectByPrivateKey = async (privateKey: string, network: Network): Promise<void> => {
    const wallet = new ethers.Wallet(privateKey, PROVIDERS[network.chainId]);
    const address = await wallet.getAddress();
    this.signer = new NonceManager(wallet) as any as JsonRpcSigner;
    this.address = address;
    this.privateKey = privateKey;
  };

  addAsset = async (assetId: string) => {
    // Не добавляем, если авторизированы по приватному ключу
    if (this.privateKey?.length) {
      return;
    }

    if (!this.address) {
      throw new NetworkError(NETWORK_ERROR.NOT_CONNECTED);
    }

    const token = TOKENS_BY_ASSET_ID[assetId];

    if (!token) {
      throw new NetworkError(NETWORK_ERROR.INVALID_TOKEN);
    }

    const walletProvider = web3Modal.getWalletProvider();

    await walletProvider?.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: assetId,
          symbol: token.symbol,
          decimals: token.decimals,
          image: token.logo,
        },
      },
    });
  };

  isWalletConnect = () => {
    const walletProvider = web3Modal.getWalletProvider();

    return walletProvider;
  };

  disconnect = async () => {
    await web3Modal.disconnect();

    this.address = null;
    this.signer = null;
    this.privateKey = null;
  };
}
