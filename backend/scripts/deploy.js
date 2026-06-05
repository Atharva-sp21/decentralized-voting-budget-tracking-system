const hre = require("hardhat");

async function main() {
 
  const ADMIN2 = "0x406d1A4Cd3EF813542817E688090ff223C08585b"; 
  const ADMIN3 = "0x635bf7662ef90b6a01c8abe8f7EE61f25EAb4776"; 

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(ADMIN2, ADMIN3);
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("Voting Contract deployed to:", address);
  console.log("Admin 1 (deployer):", (await hre.ethers.getSigners())[0].address);
  console.log("Admin 2:", ADMIN2);
  console.log("Admin 3:", ADMIN3);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});