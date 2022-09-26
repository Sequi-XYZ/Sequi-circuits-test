import {
  AztecSdk,
  createAztecSdk,
  JsonRpcProvider,
  RollupProviderStatus,
  SdkFlavour,
} from "@aztec/sdk";
import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [sdk, setSdk] = useState<AztecSdk>();
  useEffect(() => {
    const jsonRpcProvider = new JsonRpcProvider(
      "https://mainnet-fork.aztec.network:8545"
    );
    createAztecSdk(jsonRpcProvider, {
      serverUrl: "https://api.aztec.network/aztec-connect-dev/falafel",
      flavour: SdkFlavour.PLAIN,
      minConfirmation: 1,
    }).then(setSdk);
  }, []);
  const [remoteStatus, setRemoteStatus] = useState<RollupProviderStatus>();
  useEffect(() => {
    if (sdk) {
      sdk.getRemoteStatus().then(setRemoteStatus);
    }
  }, [sdk]);
  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        {!sdk && <p>Initialising Aztec SDK...</p>}
        {sdk && !remoteStatus && <p>Fetching rollup provider status...</p>}
        {remoteStatus && (
          <p>Next Rollup ID: {remoteStatus.blockchainStatus.nextRollupId}</p>
        )}
      </header>
    </div>
  );
}

export default App;
