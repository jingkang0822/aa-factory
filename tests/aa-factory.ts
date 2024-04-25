import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { BN } from "bn.js";
import { assert } from "chai";
import { AaFactory } from "../target/types/aa_factory";

describe("aa-factory", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AaFactory as Program<AaFactory>;
  const walletPublicKey = provider.wallet.publicKey;

  // Generating a new keypair
  const seedEoaSigner = Buffer.from("seedEoaSigner string for wallet generation");
  const eoaSigner = anchor.web3.Keypair.fromSeed(seedEoaSigner.slice(0, 32));

  const seed = Buffer.from("a fixed seed string for wallet generation");
  const toWallet = anchor.web3.Keypair.fromSeed(seed.slice(0, 32));

  // Generate a fee payer wallet
  const feePayer = anchor.web3.Keypair.generate();
  console.log("feePayer public key:", feePayer.publicKey.toString());

  it("Is initialized with correct salt!", async () => {

    // Airdrop some SOL to the new signer and fee payer wallets
    await airdropSol(eoaSigner.publicKey, 10); // 10 SOL
    await airdropSol(feePayer.publicKey, 10); // 10 SOL

    // Print initial balances
    console.log("Initial balances:");
    await printBalances();

    // Creating and testing the escrow PDA with a specific salt
    const salt1 = 32;
    const escrowPDA1 = await createEscrowPDA(toWallet.publicKey, salt1);
    await testEscrowCreation(escrowPDA1, salt1, toWallet.publicKey);

    // Creating and testing another escrow PDA with a different salt
    const salt2 = 64;
    const escrowPDA2 = await createEscrowPDA(toWallet.publicKey, salt2);
    await testEscrowCreation(escrowPDA2, salt2, toWallet.publicKey);

    // Print final balances
    console.log("Final balances:");
    await printBalances();
  });

  async function createEscrowPDA(toPublicKey: anchor.web3.PublicKey, salt: number): Promise<anchor.web3.PublicKey> {
    const [escrowPDA] = await anchor.web3.PublicKey.findProgramAddress([
      utf8.encode('v1.0.1'),
      eoaSigner.publicKey.toBuffer(),
      toPublicKey.toBuffer(),
      new BN(salt).toArrayLike(Buffer, 'le', 8),
    ], program.programId);
    console.log(`Escrow PDA for salt ${salt}:`, escrowPDA);
    console.log();
    return escrowPDA;
  }

  async function testEscrowCreation(escrowPDA: anchor.web3.PublicKey, salt: number, toPublicKey: anchor.web3.PublicKey) {
    await program.methods.createEscrow(new BN(salt))
    .accounts({
      from: eoaSigner.publicKey,
      to: toPublicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      escrow: escrowPDA,
      paymaster: feePayer.publicKey,
    })
    .signers([feePayer, eoaSigner])
    .rpc();

    const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
    assertEscrowAccount(escrowAccount, salt, toPublicKey);
  }

  function assertEscrowAccount(escrowAccount: any, expectedSalt: number, toPublicKey: anchor.web3.PublicKey) {
    assert.equal(escrowAccount.salt.toNumber(), expectedSalt, `Escrow salt should be ${expectedSalt}`);
    assert.isTrue(escrowAccount.from.equals(eoaSigner.publicKey), "Escrow 'from' public key should match wallet public key");
    assert.isTrue(escrowAccount.to.equals(toPublicKey), "Escrow 'to' public key should match recipient's public key");
  }

  // this airdrops sol to an address
  async function airdropSol(publicKey, amount) {
    let airdropTx = await anchor.getProvider().connection.requestAirdrop(publicKey, amount * anchor.web3.LAMPORTS_PER_SOL);
    await confirmTransaction(airdropTx);
  }

  async function confirmTransaction(tx) {
    const latestBlockHash = await anchor.getProvider().connection.getLatestBlockhash();
    await anchor.getProvider().connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    });
  }

  async function printBalances() {
    const eoaSignerBalance = await provider.connection.getBalance(eoaSigner.publicKey);
    const feePayerBalance = await provider.connection.getBalance(feePayer.publicKey);
  
    console.log("eoaSigner balance:", eoaSignerBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("feePayer balance:", feePayerBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log();
  }
});
