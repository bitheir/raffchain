import RaffleManagerABI from './RaffleManager.min.abi.json';
import RaffleDeployerABI from './RaffleDeployer.min.abi.json';
import RevenueManagerABI from './RevenueManager.min.abi.json';
import NFTFactoryABI from './NFTFactory.min.abi.json';
import ERC721PrizeABI from './ERC721Prize.min.abi.json';
import ERC1155PrizeABI from './ERC1155Prize.min.abi.json';
import RaffleABI from './Raffle.min.abi.json';

const ERC20ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)"
];

export const contractABIs = {
  raffleManager: RaffleManagerABI,
  raffleDeployer: RaffleDeployerABI,
  revenueManager: RevenueManagerABI,
  nftFactory: NFTFactoryABI,
  erc721Prize: ERC721PrizeABI,
  erc1155Prize: ERC1155PrizeABI,
  raffle: RaffleABI,
  erc20: ERC20ABI
};


