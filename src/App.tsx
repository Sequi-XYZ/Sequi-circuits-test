import "./App.css";
import { useEffect, useState } from "react";
import { BigNumber, ethers } from "ethers";
import {
  AztecSdk,
  createAztecSdk,
  EthersAdapter,
  EthereumProvider,
  SdkFlavour,
  AztecSdkUser,
  GrumpkinAddress,
  SchnorrSigner,
  EthAddress,
  TxSettlementTime,
  TxId,
  BridgeCallData,
  virtualAssetIdPlaceholder,
  AssetValue,
  UserDefiClaimTx,
} from "@aztec/sdk";
//0 == left
// import { acir_from_bytes, compile } from "@noir-lang/noir_wasm";
import Noir from "noir-js-bogota/dest/noir";

import {
  setup_generic_prover_and_verifier,
  create_proof,
  verify_proof,
  StandardExampleProver,
  StandardExampleVerifier,
} from "@noir-lang/barretenberg/dest/client_proofs";

import {
  depositEthToAztec,
  registerAccount,
  aztecConnect,
  getNote,
  path_to_uint8array,
} from "./utils";
import { fetchBridgeData } from "./bridge-data";
import path from "path";
import { HashPath } from "@noir-lang/barretenberg/dest/merkle_tree";
import { serialise_public_inputs } from "@noir-lang/aztec_backend"

declare var window: any;

const App = () => {
  const [hasMetamask, setHasMetamask] = useState(false);
  const [ethAccount, setEthAccount] = useState<EthAddress | null>(null);
  const [initing, setIniting] = useState(false);
  const [sdk, setSdk] = useState<null | AztecSdk>(null);
  const [account0, setAccount0] = useState<AztecSdkUser | null>(null);
  const [userExists, setUserExists] = useState<boolean>(false);
  const [accountPrivateKey, setAccountPrivateKey] = useState<Buffer | null>(
    null
  );
  const [accountPublicKey, setAccountPublicKey] =
    useState<GrumpkinAddress | null>(null);
  const [spendingSigner, setSpendingSigner] = useState<
    SchnorrSigner | undefined
  >(undefined);
  const [alias, setAlias] = useState("");
  const [amount, setAmount] = useState(0);
  const [txId, setTxId] = useState<TxId | null>(null);

  // Metamask Check
  useEffect(() => {
    if (window.ethereum) {
      setHasMetamask(true);
    }
    window.ethereum.on("accountsChanged", () => window.location.reload());
  }, []);

  async function connect() {
    if (window.ethereum) {
      setIniting(true); // Start init status

      // Get Metamask provider
      // TODO: Show error if Metamask is not on Aztec Testnet
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ethereumProvider: EthereumProvider = new EthersAdapter(provider);

      // Get Metamask ethAccount
      await provider.send("eth_requestAccounts", []);
      const mmSigner = provider.getSigner();
      const mmAddress = EthAddress.fromString(await mmSigner.getAddress());
      setEthAccount(mmAddress);

      // Initialize SDK
      const sdk = await createAztecSdk(ethereumProvider, {
        serverUrl: "https://api.aztec.network/aztec-connect-testnet/falafel", // Testnet
        pollInterval: 1000,
        memoryDb: true,
        debug: "bb:*",
        flavour: SdkFlavour.PLAIN,
        minConfirmation: 1, // ETH block confirmations
      });
      await sdk.run();
      console.log("Aztec SDK initialized:", sdk);
      setSdk(sdk);

      // Generate user's privacy keypair
      // The privacy keypair (also known as account keypair) is used for en-/de-crypting values of the user's spendable funds (i.e. balance) on Aztec
      // It can but is not typically used for receiving/spending funds, as the user should be able to share viewing access to his/her Aztec account via sharing his/her privacy private key
      const { publicKey: accPubKey, privateKey: accPriKey } =
        await sdk.generateAccountKeyPair(mmAddress);
      console.log("Privacy Key:", accPriKey);
      console.log("Public Key:", accPubKey.toString());
      setAccountPrivateKey(accPriKey);
      setAccountPublicKey(accPubKey);
      if (await sdk.isAccountRegistered(accPubKey)) setUserExists(true);

      // Get or generate Aztec SDK local user
      let account0 = (await sdk.userExists(accPubKey))
        ? await sdk.getUser(accPubKey)
        : await sdk.addUser(accPriKey);
      setAccount0(account0);

      // Generate user's spending key & signer
      // The spending keypair is used for receiving/spending funds on Aztec
      const { privateKey: spePriKey } = await sdk.generateSpendingKeyPair(
        mmAddress
      );
      const schSigner = await sdk?.createSchnorrSigner(spePriKey);
      console.log("Signer:", schSigner);
      setSpendingSigner(schSigner);

      setIniting(false); // End init status
    }
  }

  // Registering on Aztec enables the use of intuitive aliases for fund transfers
  // It registers an human-readable alias with the user's privacy & spending keypairs
  // All future funds transferred to the alias would be viewable with the privacy key and spendable with the spending key respectively
  async function registerNewAccount() {
    try {
      const depositTokenQuantity: bigint = ethers.utils
        .parseEther(amount.toString())
        .toBigInt();

      const txId = await registerAccount(
        accountPublicKey!,
        alias,
        accountPrivateKey!,
        spendingSigner!.getPublicKey(),
        "eth",
        depositTokenQuantity,
        TxSettlementTime.NEXT_ROLLUP,
        ethAccount!,
        sdk!
      );

      console.log("Registration TXID:", txId);
      console.log(
        "View TX on Explorer:",
        `https://aztec-connect-testnet-explorer.aztec.network/tx/${txId.toString()}`
      );
      setTxId(txId);
    } catch (e) {
      console.log(e); // e.g. Reject TX
    }
  }

  async function depositEth() {
    try {
      const depositTokenQuantity: bigint = ethers.utils
        .parseEther(amount.toString())
        .toBigInt();

      let txId = await depositEthToAztec(
        ethAccount!,
        accountPublicKey!,
        depositTokenQuantity,
        TxSettlementTime.NEXT_ROLLUP,
        sdk!
      );

      console.log("Deposit TXID:", txId);
      console.log(
        "View TX on Explorer:",
        `https://aztec-connect-testnet-explorer.aztec.network/tx/${txId.toString()}`
      );
      setTxId(txId);
    } catch (e) {
      console.log(e); // e.g. depositTokenQuantity = 0
    }
  }

  async function bridgeCrvLido() {
    try {
      const fromAmount: bigint = ethers.utils
        .parseEther(amount.toString())
        .toBigInt();

      let txId = await aztecConnect(
        account0!,
        spendingSigner!,
        6, // Testnet bridge id of CurveStEthBridge
        fromAmount,
        "ETH",
        "WSTETH",
        undefined,
        undefined,
        1e18, // Min acceptable amount of stETH per ETH
        TxSettlementTime.NEXT_ROLLUP,
        sdk!
      );

      console.log("Bridge TXID:", txId);
      console.log(
        "View TX on Explorer:",
        `https://aztec-connect-testnet-explorer.aztec.network/tx/${txId.toString()}`
      );
      setTxId(txId);
    } catch (e) {
      console.log(e); // e.g. fromAmount > user's balance
    }
  }

  async function logBalance() {
    // Wait for the SDK to read & decrypt notes to get the latest balances
    await account0!.awaitSynchronised();
    console.log(
      "Balance: zkETH -",
      sdk!.fromBaseUnits(
        await sdk!.getBalance(account0!.id, sdk!.getAssetIdBySymbol("eth"))
      ),
      ", wstETH -",
      sdk!.fromBaseUnits(
        await sdk!.getBalance(account0!.id, sdk!.getAssetIdBySymbol("wsteth"))
      )
    );
  }

  async function payRecipient() {
    const BRIDGE_ID = 30;
    const USER_ID = 1;
    // const bridgeAddress = "0x2e27daa8dfb7487c8c9ad46f874ce7122f453a5e";

    const ASSET_ID_ETHER = 0;

    const bridgeCallData = new BridgeCallData(
      BRIDGE_ID, // 28
      ASSET_ID_ETHER, // ether in
      virtualAssetIdPlaceholder, // virt out
      undefined, // no B in
      undefined, // no B out
      USER_ID // my id (auxData)
    );

    if (!sdk) throw new Error("SDK not initialized");
    const DEFAULT_AMOUNT = 10n ** 16n;
    const assetValue: AssetValue = {
      assetId: ASSET_ID_ETHER,
      value: DEFAULT_AMOUNT,
    };

    const fee = (await sdk.getDefiFees(bridgeCallData))[
      TxSettlementTime.INSTANT
    ];

    const controller = sdk.createDefiController(
      account0!.id,
      spendingSigner!,
      bridgeCallData,
      assetValue,
      fee
    );

    await controller.createProof();
    const txId = await controller.send();

    console.log("Bridge TXID:", txId);
    console.log(
      "View TX on Explorer:",
      `https://aztec-connect-testnet-explorer.aztec.network/tx/${txId.toString()}`
    );
    setTxId(txId);
  }

  async function getNotesAndGenerateProof() {
    if (!sdk || !account0 || !accountPrivateKey) throw new Error("Not ready");

    // const transactions = await logTransactions();
    const transactions = await sdk.getUserTxs(account0.id);
    console.log(transactions);
    const tx = transactions.find(
      (t) => (t as UserDefiClaimTx)?.outputValueA?.assetId === 536873281
    );
    console.log(tx);

    // let compiled_program = compile("/main.nr");
    // acir = compiled_program.circuit;

    // [prover, verifier] = await setup_generic_prover_and_verifier(acir);

    // let acirByteArray = path_to_uint8array(
    //   path.resolve(__dirname, "../circuits/build/p.acir")
    // );

    // acir = acir_from_bytes(acirByteArray);
    // [prover, verifier] = await setup_generic_prover_and_verifier(acir);
    // console.log(prover, verifier);

    const {
      hashPath,
      index: noteIndex,
      treeNote,
    } = await getNote(account0.id, 536873281, sdk);

    if (!hashPath || !noteIndex) throw new Error("Not settled");
    const hp = HashPath.fromBuffer(hashPath);

    console.log({ hp });

    const fullHashPath = await (sdk as any).core.worldState.buildFullHashPath(
      noteIndex,
      hp
    );

    let i = noteIndex;

    const note_hash_path = fullHashPath.data.map(([l, r]: [Buffer, Buffer]) => {
      let path_bit = i & 1;
      i = i >> 1;
      return path_bit === 1 ? l : r; //TODO: hash and compress?
    });

    console.log({ note_hash_path });

    const acirHex =
      "add2494ec33018056028f33ccf33a5850e8bb8495a67c724108b4a489c2069fed288b44269a8d8e606b5b3e10408ba429ca31740e22c150fa99bae134bdfca4fbffc6c87f9b7a0736bda8fe45f99ae1b7edf38af645f9a4d7aa898aee9955f5c2187bb3d994a0fe43eeec926af498d50a6b09b8613383d1b487d95c97b72a94c750be19af3fc3b949489ff1c8cc0288cc1384cc0244cc134ccc02cccc13c2cc0222cc132acc02aacc13a6cc0266cc136ecc02eecc13e1cc0211cc13124bb3d91093a179ee3d7eae43b95b02de5cfb9126db10c66a84a51d3a85420a63253291816d7154db78a9c71a673dd2e705525aef192611925c5609a4aacaa1b6ab53f241b7d44f079ed7854f19d1605ef778d1679becce606ea8a307adb6c4ec4d0371ff9204afccdf2229e978cb5595bc4f04563b86e91f803";

    const NoirJs = await Noir.new();
    let inputs = [
      `0x` + Buffer.from(accountPrivateKey).toString("hex"), // account private key
      `0x` + (noteIndex.toString(16).padStart(64, '0')), // index off the note
      `0x` +
        (await sdk.getRemoteStatus()).blockchainStatus.dataRoot.toString("hex"),
      (note_hash_path as Buffer[]).map((x) => `0x` + x.toString("hex")),
      `0x` + treeNote.noteSecret.toString("hex"), //secret
    ];
    console.log({ inputs });

    const res = await NoirJs.createProof(
      acirHex,
      inputs as unknown as any,
      1024
    );
    console.log(res.proof);
    const verified = await NoirJs.verifyProof(res.verifier, res.proof);
    console.log("VERIFIED", verified);

    // const verified = await verify_proof(verifier, proof);
    // console.log("verified: ", verified);
  }

  async function logTransactions() {
    if (!sdk) throw new Error("SDK not initialized");
    return await sdk.getUserTxs(account0!.id).then((txs) => {
      console.log(txs);
      return txs;
    });
  }

  return (
    <div className="App">
      {hasMetamask ? (
        sdk ? (
          <div>
            {userExists ? <div>Welcome back!</div> : ""}
            {spendingSigner && !userExists ? (
              <form>
                <label>
                  Alias:
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </label>
              </form>
            ) : (
              ""
            )}
            {spendingSigner ? (
              <div>
                <form>
                  <label>
                    <input
                      type="number"
                      step="0.000000000000000001"
                      min="0.000000000000000001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.valueAsNumber)}
                    />
                    ETH
                  </label>
                </form>
                {!userExists ? (
                  <>
                    <hr />
                    <button onClick={() => registerNewAccount()}>
                      Register Aztec Account
                    </button>
                    <button onClick={() => depositEth()}>Deposit ETH</button>
                    <hr />
                  </>
                ) : (
                  ""
                )}
              </div>
            ) : (
              ""
            )}
            {spendingSigner && account0 ? <div></div> : ""}
            <hr />
            {accountPrivateKey ? (
              <button onClick={() => logBalance()}>Log Balance</button>
            ) : (
              ""
            )}
            <button onClick={logTransactions}>Log transactions</button>
            <br />
            <hr />
            <button onClick={payRecipient}>SUBSCRIBE</button>
            <button onClick={getNotesAndGenerateProof}>UNLOCK CONTENT</button>
            {txId ? (
              <div>
                Last TX: {txId.toString()}{" "}
                <a
                  href={`https://aztec-connect-testnet-explorer.aztec.network/tx/${txId.toString()}`}
                >
                  (View on Explorer)
                </a>
              </div>
            ) : (
              ""
            )}
          </div>
        ) : (
          <button onClick={() => connect()}>Connect Metamask</button>
        )
      ) : (
        // TODO: Fix rendering of this. Not rendered, reason unknown.
        "Metamask is not detected. Please make sure it is installed and enabled."
      )}
      {initing ? <div>Initializing...</div> : ""}
    </div>
  );
};

export default App;
