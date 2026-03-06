import * as StellarSdk from '@stellar/stellar-sdk';

const rawSecret = process.argv[2];
const secret = rawSecret.match(/S[A-Z0-9]{55}/)[0];
const adminKeypair = StellarSdk.Keypair.fromSecret(secret);
const contractId = "CCAN5LJXW2YTXRKB3JL3QUFC52N3IK6IZULZ23NJ3EGDVZA2QF6BW33Q";
const usdcAddress = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const server = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org');

async function main() {
    const contract = new StellarSdk.Contract(contractId);
    const account = await server.getAccount(adminKeypair.publicKey());

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: 'Test SDF Network ; September 2015'
    });

    const op = contract.call(
        "initialize",
        new StellarSdk.Address(adminKeypair.publicKey()).toScVal(),
        new StellarSdk.Address(usdcAddress).toScVal()
    );

    txBuilder.addOperation(op).setTimeout(30);
    let tx = txBuilder.build();

    // Simulate
    const simParams = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simParams)) {
        console.error("Simulation error:", simParams.error);
        return;
    }

    // Assemble
    tx = StellarSdk.rpc.assembleTransaction(tx, simParams).build();

    // Sign
    tx.sign(adminKeypair);

    // Submit
    const response = await server.sendTransaction(tx);
    console.log("Tx hash:", response.hash);

    // Wait for result
    while (true) {
        const statusResult = await server.getTransaction(response.hash);
        if (statusResult.status !== "NOT_FOUND") {
            console.log("Status:", statusResult.status);
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

main().catch(console.error);
