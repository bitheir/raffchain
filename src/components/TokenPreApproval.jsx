import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import erc20Abi from '../contracts/erc20.min.abi.json';
import erc721Abi from '../contracts/ERC721Prize.min.abi.json';
import erc1155Abi from '../contracts/ERC1155Prize.min.abi.json';
import { Button } from './ui/button';
import { SUPPORTED_NETWORKS } from '../networks';

const PRIZE_TYPES = [
  { label: 'ERC20', value: 'erc20' },
  { label: 'ERC721', value: 'erc721' },
  { label: 'ERC1155', value: 'erc1155' },
];

export default function TokenPreApproval() {
  const { address, connected, chainId, signer } = useWallet();
  const { provider } = useContract();
  const [prizeType, setPrizeType] = useState('erc20');
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loading, setLoading] = useState(false);
  const [raffleDeployerAddress, setRaffleDeployerAddress] = useState('');

  // Fetch raffleDeployerAddress when chainId changes
  useEffect(() => {
    if (!chainId) {
      setRaffleDeployerAddress('');
      return;
    }
    const networkConfig = SUPPORTED_NETWORKS[chainId];
    const deployer = networkConfig?.contractAddresses?.raffleDeployer || '';
    setRaffleDeployerAddress(deployer);
  }, [chainId]);

  // Helper: Validate Ethereum address
  const isValidAddress = (addr) => {
    try {
      return ethers.utils.isAddress(addr);
    } catch {
      return false;
    }
  };

  // Approve handler
  const handleApprove = async (e) => {
    e.preventDefault();
    // Debug logging
    console.log('[TokenPreApproval] Approve clicked:', {
      raffleDeployerAddress,
      tokenAddress,
      prizeType,
      amount,
      tokenId,
      connected,
      provider,
      signer
    });
    if (!isValidAddress(tokenAddress)) {
      toast.error('Invalid token contract address');
      return;
    }
    if (!isValidAddress(raffleDeployerAddress)) {
      toast.error('Invalid RaffleDeployer address');
      return;
    }
    if (!connected) {
      toast.error('Connect your wallet');
      return;
    }
    if (!signer) {
      toast.error('No signer found. Please reconnect your wallet.');
      return;
    }
    setLoading(true);
    try {
      let contract, tx;
      if (prizeType === 'erc20') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          toast.error('Enter a valid amount');
          setLoading(false);
          return;
        }
        contract = new ethers.Contract(tokenAddress, erc20Abi, signer);
        tx = await contract.approve(raffleDeployerAddress, ethers.utils.parseUnits(amount, 18));
      } else if (prizeType === 'erc721') {
        if (!tokenId || isNaN(tokenId) || Number(tokenId) < 0) {
          toast.error('Enter a valid token ID');
          setLoading(false);
          return;
        }
        contract = new ethers.Contract(tokenAddress, erc721Abi, signer);
        tx = await contract.approve(raffleDeployerAddress, tokenId);
      } else if (prizeType === 'erc1155') {
        contract = new ethers.Contract(tokenAddress, erc1155Abi, signer);
        tx = await contract.setApprovalForAll(raffleDeployerAddress, true);
      }
      await tx.wait();
      toast.success('Approval successful!');
    } catch (error) {
      let message = error?.reason || error?.data?.message || error?.message || 'Approval failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mt-6 w-96 max-w-full">
      <h4 className="text-lg font-semibold mb-4">Token Pre-Approval</h4>
      <p className="text-xs text-muted-foreground mb-4">Grant RaffleDeployer approval to escrow prizes before creating a raffle.</p>
      <form onSubmit={handleApprove} className="space-y-4">
        <div>
          <label className="block text-base font-medium mb-2">Prize Type</label>
          <select
            className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm w-full"
            value={prizeType}
            onChange={e => setPrizeType(e.target.value)}
          >
            {PRIZE_TYPES.map(type => (
              <option key={type.value} value={type.value} className="bg-white text-black dark:bg-gray-900 dark:text-white text-sm">
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Prize Token Contract Address</label>
          <input
            type="text"
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
            placeholder="0x..."
            required
          />
        </div>
        {prizeType === 'erc20' && (
          <div>
            <label className="block text-base font-medium mb-2">Amount</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
              required
            />
          </div>
        )}
        {prizeType === 'erc721' && (
          <div>
            <label className="block text-base font-medium mb-2">Token ID</label>
            <input
              type="number"
              min="0"
              value={tokenId}
              onChange={e => setTokenId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
              required
            />
          </div>
        )}
        <div>
          <Button
            type="submit"
            disabled={loading || !connected || !isValidAddress(raffleDeployerAddress)}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </form>
    </div>
  );
} 