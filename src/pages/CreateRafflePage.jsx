import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertCircle, Gift, Coins } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { formatErrorForToast } from '../utils/errorUtils';
import erc20Abi from '../contracts/erc20.min.abi.json';
import erc721Abi from '../contracts/ERC721Prize.min.abi.json';
import erc1155Abi from '../contracts/ERC1155Prize.min.abi.json';
import { SUPPORTED_NETWORKS } from '../networks';

// Utility function to check if tokens are already approved
const checkTokenApproval = async (signer, tokenAddress, prizeType, raffleDeployerAddress, amount, tokenId) => {
  try {
    let contract;
    const userAddress = await signer.getAddress();
    
    console.log('Checking token approval status:', {
      userAddress,
      tokenAddress,
      prizeType,
      raffleDeployerAddress,
      amount,
      tokenId
    });
    
    if (prizeType === 'erc20') {
      contract = new ethers.Contract(tokenAddress, erc20Abi, signer);
      const allowance = await contract.allowance(userAddress, raffleDeployerAddress);
      const requiredAmount = ethers.utils.parseUnits(amount, 18);
      console.log('ERC20 approval check:', {
        allowance: allowance.toString(),
        requiredAmount: requiredAmount.toString(),
        isApproved: allowance.gte(requiredAmount)
      });
      
      // If allowance is 0, check recent approval events as a fallback
      if (allowance.toString() === '0') {
        console.log('Allowance is 0, checking recent approval events...');
        try {
          // Get the last 1000 blocks to look for approval events
          const currentBlock = await signer.provider.getBlockNumber();
          const fromBlock = Math.max(0, currentBlock - 1000);
          
          // Create the approval event filter manually since contract.filters might not work
          const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
          const userAddressPadded = '0x' + userAddress.slice(2).padStart(64, '0');
          const spenderAddressPadded = '0x' + raffleDeployerAddress.slice(2).padStart(64, '0');
          
          const logs = await signer.provider.getLogs({
            address: tokenAddress,
            topics: [approvalEventSignature, userAddressPadded, spenderAddressPadded],
            fromBlock: fromBlock,
            toBlock: currentBlock
          });
          
          console.log('Recent approval events:', logs);
          
          // Check if any recent approval events have sufficient allowance
          for (const log of logs) {
            const approvalAmount = ethers.BigNumber.from(log.data);
            console.log('Found approval event with amount:', approvalAmount.toString());
            if (approvalAmount.gte(requiredAmount)) {
              console.log('Found recent approval event with sufficient allowance:', approvalAmount.toString());
              return true;
            }
          }
        } catch (error) {
          console.error('Error checking approval events:', error);
        }
      }
      
      return allowance.gte(requiredAmount);
    } else if (prizeType === 'erc721') {
      contract = new ethers.Contract(tokenAddress, erc721Abi, signer);
      const approved = await contract.getApproved(tokenId);
      const isApproved = approved.toLowerCase() === raffleDeployerAddress.toLowerCase();
      console.log('ERC721 approval check:', {
        approved,
        raffleDeployerAddress,
        isApproved
      });
      return isApproved;
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, erc1155Abi, signer);
      const isApproved = await contract.isApprovedForAll(userAddress, raffleDeployerAddress);
      console.log('ERC1155 approval check:', {
        userAddress,
        raffleDeployerAddress,
        isApproved
      });
      return isApproved;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking token approval:', error);
    return false;
  }
};

// Utility function for token approval
const approveToken = async (signer, tokenAddress, prizeType, raffleDeployerAddress, amount, tokenId) => {
  try {
    let contract, tx;
    
    console.log('Approval details:', {
      tokenAddress,
      prizeType,
      raffleDeployerAddress,
      amount,
      tokenId
    });
    
    // Check if already approved
    const isAlreadyApproved = await checkTokenApproval(signer, tokenAddress, prizeType, raffleDeployerAddress, amount, tokenId);
    
    console.log('Approval check result:', {
      isAlreadyApproved,
      prizeType,
      tokenAddress,
      raffleDeployerAddress
    });
    
    if (isAlreadyApproved) {
      console.log('Token is already approved, skipping approval transaction');
      return { success: true, alreadyApproved: true };
    }
    
    console.log('Token not approved, proceeding with approval transaction...');
    
    if (prizeType === 'erc20') {
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        throw new Error('Enter a valid amount');
      }
      contract = new ethers.Contract(tokenAddress, erc20Abi, signer);
      const approvalAmount = ethers.utils.parseUnits(amount, 18);
      console.log('ERC20 approval amount:', approvalAmount.toString());
      
      // Test the contract functions
      try {
        const testAllowance = await contract.allowance(await signer.getAddress(), raffleDeployerAddress);
        console.log('Test allowance before approval:', testAllowance.toString());
      } catch (error) {
        console.error('Error testing allowance function:', error);
      }
      
      tx = await contract.approve(raffleDeployerAddress, approvalAmount);
    } else if (prizeType === 'erc721') {
      if (!tokenId || isNaN(tokenId) || Number(tokenId) < 0) {
        throw new Error('Enter a valid token ID');
      }
      contract = new ethers.Contract(tokenAddress, erc721Abi, signer);
      console.log('ERC721 approval for token ID:', tokenId);
      tx = await contract.approve(raffleDeployerAddress, tokenId);
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, erc1155Abi, signer);
      console.log('ERC1155 setApprovalForAll for address:', raffleDeployerAddress);
      tx = await contract.setApprovalForAll(raffleDeployerAddress, true);
    }
    
    console.log('Approval transaction submitted:', tx.hash);
    console.log('Waiting for approval transaction confirmation...');
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Approval transaction confirmed:', receipt.transactionHash);
    console.log('Approval transaction receipt:', receipt);
    
    // Check if the transaction was successful
    if (receipt.status === 0) {
      console.error('Approval transaction failed!');
      throw new Error('Approval transaction failed');
    }
    
    // Check for approval events in the transaction logs
    console.log('Checking transaction logs for approval events...');
    if (receipt.logs && receipt.logs.length > 0) {
      console.log('Transaction logs:', receipt.logs);
    }
    
    // Try to get the approval event directly
    try {
      const approvalEvent = receipt.logs?.find(log => {
        // Look for Approval event signature
        return log.topics && log.topics[0] === '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
      });
      if (approvalEvent) {
        console.log('Found approval event:', approvalEvent);
      }
    } catch (error) {
      console.error('Error parsing approval event:', error);
    }
    
    // Verify the approval was successful by checking again
    console.log('Verifying approval was successful...');
    
    // For ERC20, check the approval event in the transaction receipt
    if (prizeType === 'erc20') {
      const approvalEvent = receipt.logs?.find(log => {
        return log.topics && log.topics[0] === '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
      });
      
      if (approvalEvent) {
        const approvalAmount = ethers.BigNumber.from(approvalEvent.data);
        const requiredAmount = ethers.utils.parseUnits(amount, 18);
        const isApproved = approvalAmount.gte(requiredAmount);
        console.log('Approval verification from event:', {
          approvalAmount: approvalAmount.toString(),
          requiredAmount: requiredAmount.toString(),
          isApproved
        });
        return { success: true, receipt, alreadyApproved: false };
      }
    }
    
    const verificationResult = await checkTokenApproval(signer, tokenAddress, prizeType, raffleDeployerAddress, amount, tokenId);
    console.log('Approval verification result:', verificationResult);
    
    // Add a small delay to ensure the blockchain state is updated
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { success: true, receipt };
  } catch (error) {
    console.error('Approval error:', error);
    return { success: false, error: error.message };
  }
};

function ERC1155DropForm() {
  const { connected, address, signer } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    unitsPerWinner: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !signer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      // Get raffleDeployer address
      const chainId = await signer.provider.getNetwork().then(net => net.chainId);
      const networkConfig = SUPPORTED_NETWORKS[chainId];
      const raffleDeployerAddress = networkConfig?.contractAddresses?.raffleDeployer;
      
      if (!raffleDeployerAddress) {
        throw new Error('RaffleDeployer address not found for current network');
      }

      // Step 1: Approve token
      console.log('Starting token approval for ERC1155...');
      const approvalResult = await approveToken(
        signer,
        formData.collectionAddress,
        'erc1155',
        raffleDeployerAddress,
        null,
        null
      );
      
      if (!approvalResult.success) {
        throw new Error('Token approval failed: ' + approvalResult.error);
      }
      
      if (approvalResult.alreadyApproved) {
        console.log('Token was already approved, proceeding to create raffle...');
      } else {
        console.log('Token approval successful, creating raffle...');
        // Add additional delay to ensure approval is fully processed
        console.log('Waiting additional time for approval to be fully processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const unitsPerWinner = formData.unitsPerWinner ? parseInt(formData.unitsPerWinner) : 1;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: unitsPerWinner,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      const result = await executeTransaction(
        contracts.raffleDeployer.createRaffle,
        [
          params.name,
          params.startTime,
          params.duration,
          params.ticketLimit,
          params.winnersCount,
          params.maxTicketsPerParticipant,
          params.isPrized,
          params.customTicketPrice,
          params.erc721Drop,
          params.prizeCollection,
          params.standard,
          params.prizeTokenId,
          params.amountPerWinner,
          params.collectionName,
          params.collectionSymbol,
          params.collectionBaseURI,
          params.creator,
          params.royaltyPercentage,
          params.royaltyRecipient,
          params.maxSupply,
          params.erc20PrizeToken,
          params.erc20PrizeAmount,
          params.ethPrizeAmount
        ]
      );
      if (result.success) {
        toast.success('ERC1155 Collection raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          unitsPerWinner: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create ERC1155 Collection Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Units Per Winner</label>
            <input
              type="number"
              min="1"
              value={formData.unitsPerWinner || ''}
              onChange={e => handleChange('unitsPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH)</label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        
        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const PrizedRaffleForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    customTicketPrice: '',
    prizeSource: 'new',
    prizeCollection: '',
    prizeType: 'erc721',
    prizeTokenId: '',
    amountPerWinner: '1',
    useMintableWorkflow: false,
    isEscrowed: false,
    // New collection fields
    collectionName: '',
    collectionSymbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }

    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.customTicketPrice ? 
        ethers.utils.parseEther(formData.customTicketPrice) : 0;

      let result;
      let params;

      if (formData.prizeSource === 'new') {
        // New ERC721 collection
        params = {
          name: formData.name,
          startTime,
          duration,
          ticketLimit: parseInt(formData.ticketLimit),
          winnersCount: parseInt(formData.winnersCount),
          maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
          isPrized: true,
          customTicketPrice: customTicketPrice,
          erc721Drop: false,
          prizeCollection: ethers.constants.AddressZero,
          standard: 0, // ERC721
          prizeTokenId: 0,
          amountPerWinner: 1,
          collectionName: formData.collectionName,
          collectionSymbol: formData.collectionSymbol,
          collectionBaseURI: formData.baseURI,
          creator: address,
          royaltyPercentage: parseInt(formData.royaltyPercentage || '0'),
          royaltyRecipient: ethers.constants.AddressZero,
          maxSupply: parseInt(formData.maxSupply || formData.winnersCount),
          erc20PrizeToken: ethers.constants.AddressZero,
          erc20PrizeAmount: 0,
          ethPrizeAmount: 0
        };
      } else {
        // Existing collection (ERC721 or ERC1155)
        const standard = formData.prizeType === 'erc721' ? 0 : 1;
        params = {
          name: formData.name,
          startTime,
          duration,
          ticketLimit: parseInt(formData.ticketLimit),
          winnersCount: parseInt(formData.winnersCount),
          maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
          isPrized: true,
          customTicketPrice: customTicketPrice,
          erc721Drop: formData.useMintableWorkflow,
          prizeCollection: formData.prizeCollection,
          standard: standard,
          prizeTokenId: formData.useMintableWorkflow ? 0 : parseInt(formData.prizeTokenId),
          amountPerWinner: parseInt(formData.amountPerWinner),
          collectionName: '',
          collectionSymbol: '',
          collectionBaseURI: '',
          creator: address,
          royaltyPercentage: 0,
          royaltyRecipient: ethers.constants.AddressZero,
          maxSupply: 0,
          erc20PrizeToken: ethers.constants.AddressZero,
          erc20PrizeAmount: 0,
          ethPrizeAmount: 0
        };
      }

      result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }

      if (result.success) {
        // Save social media tasks to database
        if (socialTasks.length > 0) {
          try {
            const taskResult = await SocialTaskService.createRaffleTasks(
              result.raffleAddress || 'pending',
              socialTasks
            );
            if (!taskResult.success) {
              console.warn('Failed to save social media tasks:', taskResult.error);
            }
          } catch (taskError) {
            console.warn('Error saving social media tasks:', taskError);
          }
        }

        toast.success('Prized raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          customTicketPrice: '',
          prizeSource: 'new',
          prizeCollection: '',
          prizeType: 'erc721',
          prizeTokenId: '',
          amountPerWinner: '1',
          useMintableWorkflow: false,
          isEscrowed: false,
          collectionName: '',
          collectionSymbol: '',
          baseURI: '',
          maxSupply: '',
          royaltyPercentage: ''
        });
        setSocialTasks([]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Prized Raffle</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Custom Ticket Price */}
        <div>
          <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
          <input
            type="number"
            step="0.001"
            value={formData.customTicketPrice || ''}
            onChange={(e) => handleChange('customTicketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            placeholder="Leave empty to use protocol default"
          />
        </div>

        {/* Prize Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Prize Configuration</h4>
          
          <div>
            <label className="block text-base font-medium mb-3">Prize Source</label>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-base">
                <input
                  type="radio"
                  name="prizeSource"
                  value="new"
                  checked={formData.prizeSource === 'new'}
                  onChange={(e) => handleChange('prizeSource', e.target.value)}
                  className="w-4 h-4"
                />
                <span>Create New Collection</span>
              </label>
              <label className="flex items-center gap-2 text-base">
                <input
                  type="radio"
                  name="prizeSource"
                  value="existing"
                  checked={formData.prizeSource === 'existing'}
                  onChange={(e) => handleChange('prizeSource', e.target.value)}
                  className="w-4 h-4"
                />
                <span>Use Existing Collection</span>
              </label>
            </div>
          </div>

          {formData.prizeSource === 'new' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl">
              <div>
                <label className="block text-base font-medium mb-2">Collection Name</label>
                <input
                  type="text"
                  value={formData.collectionName || ''}
                  onChange={(e) => handleChange('collectionName', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Collection Symbol</label>
                <input
                  type="text"
                  value={formData.collectionSymbol || ''}
                  onChange={(e) => handleChange('collectionSymbol', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Base URI</label>
                <input
                  type="url"
                  value={formData.baseURI || ''}
                  onChange={(e) => handleChange('baseURI', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Max Supply</label>
                <input
                  type="number"
                  value={formData.maxSupply || ''}
                  onChange={(e) => handleChange('maxSupply', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Royalty Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.royaltyPercentage || ''}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0-10%"
                />
              </div>
            </div>
          )}

          {formData.prizeSource === 'existing' && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-xl">
              <div>
                <label className="block text-base font-medium mb-2">Prize Collection Address</label>
                <input
                  type="text"
                  value={formData.prizeCollection || ''}
                  onChange={(e) => handleChange('prizeCollection', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-3">Prize Type</label>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="prizeType"
                      value="erc721"
                      checked={formData.prizeType === 'erc721'}
                      onChange={(e) => handleChange('prizeType', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>ERC721</span>
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="prizeType"
                      value="erc1155"
                      checked={formData.prizeType === 'erc1155'}
                      onChange={(e) => handleChange('prizeType', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>ERC1155</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useMintableWorkflow"
                  checked={formData.useMintableWorkflow}
                  onChange={(e) => handleChange('useMintableWorkflow', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="useMintableWorkflow" className="text-base font-medium">
                  Use Mintable Workflow
                </label>
              </div>

              {!formData.useMintableWorkflow && (
                <div>
                  <label className="block text-base font-medium mb-2">Token ID</label>
                  <input
                    type="number"
                    value={formData.prizeTokenId || ''}
                    onChange={(e) => handleChange('prizeTokenId', e.target.value)}
                    className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                    required
                  />
                </div>
              )}
              
              <div>
                <label className="block text-base font-medium mb-2">Amount Per Winner</label>
                <input
                  type="number"
                  value={formData.amountPerWinner || ''}
                  onChange={(e) => handleChange('amountPerWinner', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const NonPrizedRaffleForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }

    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds

      const result = await executeTransaction(
        contracts.raffleDeployer.createRaffle,
        formData.name,
        startTime,
        duration,
        parseInt(formData.ticketLimit),
        parseInt(formData.winnersCount),
        parseInt(formData.maxTicketsPerParticipant),
        false, // isPrized
        0, // customTicketPrice
        false, // useMintableWorkflow
        ethers.constants.AddressZero, // prizeCollection
        0, // standard
        0, // prizeTokenId
        0, // amountPerWinner
        '', '', '', // collection creation params
        address, // creator
        0,
        ethers.constants.AddressZero,
        0
      );

      if (result.success) {
        toast.success('Non-prized raffle created successfully!');
        // Reset form
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Non-Prized Raffle</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const WhitelistRaffleForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds

      // All prize params are zero/empty for whitelist raffle
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: false,
        customTicketPrice: 0,
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero,
        standard: 0,
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Whitelist raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Whitelist Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const NewERC721DropForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    customTicketPrice: '',
    collectionName: '',
    collectionSymbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.customTicketPrice ? ethers.utils.parseEther(formData.customTicketPrice) : 0;
      const maxSupply = formData.maxSupply ? parseInt(formData.maxSupply) : parseInt(formData.winnersCount);
      // Multiply by 100 to match contract expectations (e.g., 5% -> 500)
      const royaltyPercentage = formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0;
      const prizeCollection = ethers.constants.AddressZero;
      // Build struct object
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice,
        erc721Drop: false,
        prizeCollection,
        standard: 0, // ERC721
        prizeTokenId: 0,
        amountPerWinner: 1,
        collectionName: formData.collectionName,
        collectionSymbol: formData.collectionSymbol,
        collectionBaseURI: formData.baseURI,
        creator: address,
        royaltyPercentage,
        royaltyRecipient: address,
        maxSupply,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('New ERC721 Collection raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          customTicketPrice: '',
          collectionName: '',
          collectionSymbol: '',
          baseURI: '',
          maxSupply: '',
          royaltyPercentage: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create New ERC721 Collection Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
          <input
            type="number"
            step="0.001"
            value={formData.customTicketPrice || ''}
            onChange={(e) => handleChange('customTicketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            placeholder="Leave empty to use protocol default"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 rounded-xl p-4">
          <div>
            <label className="block text-base font-medium mb-2">Collection Name</label>
            <input
              type="text"
              value={formData.collectionName || ''}
              onChange={(e) => handleChange('collectionName', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Collection Symbol</label>
            <input
              type="text"
              value={formData.collectionSymbol || ''}
              onChange={(e) => handleChange('collectionSymbol', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Base URI</label>
            <input
              type="url"
              value={formData.baseURI || ''}
              onChange={(e) => handleChange('baseURI', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Supply</label>
            <input
              type="number"
              value={formData.maxSupply || ''}
              onChange={(e) => handleChange('maxSupply', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Royalty Percentage</label>
            <input
              type="number"
              min="0"
              max="10"
              value={formData.royaltyPercentage || ''}
              onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              placeholder="0-10%"
            />
          </div>
        </div>
        
        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

function ExistingERC721DropForm() {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collection: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerUser: '',
    ticketPrice: '',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Required';
    if (!formData.collection || !/^0x[a-fA-F0-9]{40}$/.test(formData.collection)) newErrors.collection = 'Invalid address';
    if (!formData.startTime) newErrors.startTime = 'Required';
    if (!formData.duration || formData.duration < 1) newErrors.duration = 'Must be at least 1 minute';
    if (!formData.ticketLimit || formData.ticketLimit < 1) newErrors.ticketLimit = 'Must be at least 1';
    if (!formData.winnersCount || formData.winnersCount < 1) newErrors.winnersCount = 'Must be at least 1';
    if (!formData.maxTicketsPerUser || formData.maxTicketsPerUser < 1) newErrors.maxTicketsPerUser = 'Must be at least 1';
    if (formData.ticketPrice && parseFloat(formData.ticketPrice) < 0.00000001) newErrors.ticketPrice = 'Must be at least 0.00000001 ETH';
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerUser),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: true,
        prizeCollection: formData.collection.trim(),
        standard: 0, // ERC721
        prizeTokenId: 0,
        amountPerWinner: 1,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Existing ERC721 Collection raffle created successfully!');
        setFormData({
          name: '',
          collection: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerUser: '',
          ticketPrice: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Raffle (Existing ERC721 Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collection || ''}
              onChange={e => handleChange('collection', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              min="1"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              min="1"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              min="1"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per User</label>
            <input
              type="number"
              min="1"
              value={formData.maxTicketsPerUser || ''}
              onChange={e => handleChange('maxTicketsPerUser', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            Create Raffle
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Update FILTERS ---
const FILTERS = {
  raffleType: ['Whitelist/Allowlist', 'NFTDrop', 'Lucky Sale/NFT Giveaway', 'ETH Giveaway', 'ERC20 Token Giveaway'],
  nftStandard: ['ERC721', 'ERC1155'],
  erc721Source: ['New ERC721 Collection', 'Existing ERC721 Collection'], // Removed 'Escrowed ERC721'
  escrowedSource: ['Internal NFT Prize', 'External NFT Prize'],
  luckySaleSource: ['Internal NFT Prize', 'External NFT Prize'],
  erc1155Source: ['Existing ERC1155 Collection', 'Escrowed ERC1155'],
};

const CreateRafflePage = () => {
  const { connected } = useWallet();
  const { contracts } = useContract();
  const [allowExisting721, setAllowExisting721] = useState(null);

  // Filter state
  const [raffleType, setRaffleType] = useState('Whitelist/Allowlist');
  const [nftStandard, setNftStandard] = useState('ERC721');
  const [erc721Source, setErc721Source] = useState('New ERC721 Collection');
  const [erc721EscrowedSource, setErc721EscrowedSource] = useState('Internal NFT Prize');
  const [erc1155EscrowedSource, setErc1155EscrowedSource] = useState('Internal NFT Prize');
  const [luckySaleSource, setLuckySaleSource] = useState('Internal NFT Prize');
  const [erc1155Source, setErc1155Source] = useState('Existing ERC1155 Collection');
  // Track collection address for existing ERC721
  const [existingCollectionAddress, setExistingCollectionAddress] = useState('');

  // Query allowExisting721 if needed
  useEffect(() => {
    const fetchAllowExisting = async () => {
      if (raffleType === 'NFTDrop' && nftStandard === 'ERC721' && erc721Source === 'Existing ERC721 Collection' && contracts.raffleManager) {
        try {
          const allowed = await contracts.raffleManager.toggleAllowExistingCollection();
          setAllowExisting721(!!allowed);
        } catch (e) {
          setAllowExisting721(false);
        }
      }
    };
    fetchAllowExisting();
  }, [raffleType, nftStandard, erc721Source, contracts.raffleManager]);

  // Reset collection address when switching to New ERC721 Collection
  useEffect(() => {
    if (raffleType === 'NFTDrop' && nftStandard === 'ERC721' && erc721Source === 'New ERC721 Collection') {
      setExistingCollectionAddress('');
    }
  }, [raffleType, nftStandard, erc721Source]);

  // --- Dropdown Filter Card UI ---
  const renderFilterCard = () => (
    <div className="flex flex-col gap-4 p-6 bg-card border border-border rounded-xl min-h-0 w-96 max-w-full">
      {/* Raffle Type */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold text-sm whitespace-nowrap">Raffle Type</label>
        <select
          className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
          value={raffleType}
          onChange={e => setRaffleType(e.target.value)}
        >
          {FILTERS.raffleType.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      {/* NFTDrop subfilters */}
      {raffleType === 'NFTDrop' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-sm whitespace-nowrap">NFT Standard</label>
            <select
              className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
              value={nftStandard}
              onChange={e => setNftStandard(e.target.value)}
            >
              {FILTERS.nftStandard.map(std => (
                <option key={std} value={std}>{std}</option>
              ))}
            </select>
          </div>
          {nftStandard === 'ERC721' && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">ERC721 Source</label>
              <select
                className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
                value={erc721Source}
                onChange={e => setErc721Source(e.target.value)}
              >
                {FILTERS.erc721Source.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      {/* Lucky Sale subfilters */}
      {raffleType === 'Lucky Sale/NFT Giveaway' && (
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm whitespace-nowrap">NFT Standard</label>
          <select
            className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
            value={nftStandard}
            onChange={e => setNftStandard(e.target.value)}
          >
            {FILTERS.nftStandard.map(std => (
              <option key={std} value={std}>{std}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // --- Main Form Rendering Logic ---
  const renderForm = () => {
    if (raffleType === 'Whitelist/Allowlist') return <WhitelistRaffleForm />;
    if (raffleType === 'NFTDrop') {
      if (nftStandard === 'ERC721') {
        if (erc721Source === 'New ERC721 Collection') return <NewERC721DropForm />;
        if (erc721Source === 'Existing ERC721 Collection') return <ExistingERC721DropForm collectionAddress={existingCollectionAddress} setCollectionAddress={setExistingCollectionAddress} />;
      }
      if (nftStandard === 'ERC1155') {
        return <ERC1155DropForm />;
      }
    }
    if (raffleType === 'Lucky Sale/NFT Giveaway') {
      if (nftStandard === 'ERC721') return <LuckySaleERC721Form />;
      if (nftStandard === 'ERC1155') return <LuckySaleERC1155Form />;
    }
    if (raffleType === 'ETH Giveaway') return <ETHGiveawayForm />;
    if (raffleType === 'ERC20 Token Giveaway') return <ERC20GiveawayForm />;
    return null;
  };

  // Helper to get RaffleDeployer address from network
  const getRaffleDeployerAddress = () => {
    const chainId = contracts?.chainId;
    if (!chainId || !contracts?.SUPPORTED_NETWORKS) return '';
    return contracts.SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleDeployer || '';
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Plus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to create raffles and deploy collections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6 pb-16">
      <div className="container mx-auto px-8">
        <div className="mb-4 text-center">
          <h1 className="text-4xl font-bold mb-4">
            Create an on-chain raffle for your community
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto mt-16">
          <div className="lg:col-span-1 flex flex-col items-start gap-6" style={{ minWidth: '24rem', maxWidth: '24rem' }}>
            {renderFilterCard()}

            {raffleType === 'NFTDrop' && nftStandard === 'ERC1155' && (
              <Link
                to="/deploy-erc1155-collection"
                className="block w-full mt-2 bg-gradient-to-r from-green-500 to-teal-600 text-white px-5 py-3 rounded-lg hover:from-green-600 hover:to-teal-700 transition-colors flex items-center justify-center gap-2 text-base h-12"
                style={{ minWidth: '100%' }}
              >
                Deploy ERC1155 Collection
              </Link>
            )}
          </div>
          <div className="lg:col-span-3 lg:ml-10">
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add LuckySaleERC721Form
function LuckySaleERC721Form() {
  const { connected, address, signer } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !signer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      // Get raffleDeployer address
      const chainId = await signer.provider.getNetwork().then(net => net.chainId);
      const networkConfig = SUPPORTED_NETWORKS[chainId];
      const raffleDeployerAddress = networkConfig?.contractAddresses?.raffleDeployer;
      
      if (!raffleDeployerAddress) {
        throw new Error('RaffleDeployer address not found for current network');
      }

      // Step 1: Approve token
      console.log('Starting token approval for ERC721...');
      const approvalResult = await approveToken(
        signer,
        formData.collectionAddress,
        'erc721',
        raffleDeployerAddress,
        null,
        formData.tokenId
      );
      
      if (!approvalResult.success) {
        throw new Error('Token approval failed: ' + approvalResult.error);
      }
      
      if (approvalResult.alreadyApproved) {
        console.log('Token was already approved, proceeding to create raffle...');
      } else {
        console.log('Token approval successful, creating raffle...');
        // Add additional delay to ensure approval is fully processed
        console.log('Waiting additional time for approval to be fully processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 0, // ERC721
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: 1,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Lucky Sale ERC721 raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Lucky Sale (ERC721 Escrowed Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add LuckySaleERC1155Form (like ERC1155DropForm but no deploy button)
function LuckySaleERC1155Form() {
  const { connected, address, signer } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    unitsPerWinner: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !signer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      // Get raffleDeployer address
      const chainId = await signer.provider.getNetwork().then(net => net.chainId);
      const networkConfig = SUPPORTED_NETWORKS[chainId];
      const raffleDeployerAddress = networkConfig?.contractAddresses?.raffleDeployer;
      
      if (!raffleDeployerAddress) {
        throw new Error('RaffleDeployer address not found for current network');
      }

      // Step 1: Approve token
      console.log('Starting token approval for ERC1155...');
      const approvalResult = await approveToken(
        signer,
        formData.collectionAddress,
        'erc1155',
        raffleDeployerAddress,
        null,
        null
      );
      
      if (!approvalResult.success) {
        throw new Error('Token approval failed: ' + approvalResult.error);
      }
      
      if (approvalResult.alreadyApproved) {
        console.log('Token was already approved, proceeding to create raffle...');
      } else {
        console.log('Token approval successful, creating raffle...');
        // Add additional delay to ensure approval is fully processed
        console.log('Waiting additional time for approval to be fully processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const unitsPerWinner = formData.unitsPerWinner ? parseInt(formData.unitsPerWinner) : 1;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: unitsPerWinner,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Lucky Sale ERC1155 raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          unitsPerWinner: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Lucky Sale (ERC1155 Escrowed Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Units Per Winner</label>
            <input
              type="number"
              min="1"
              value={formData.unitsPerWinner || ''}
              onChange={e => handleChange('unitsPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        {/* Social Media Tasks Section */}
        <div className="mt-8">
          {/* Placeholder for social media tasks section */}
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add ETHGiveawayForm
function ETHGiveawayForm() {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ethAmount: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ethAmount = formData.ethAmount ? ethers.utils.parseEther(formData.ethAmount) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: 0,
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero, // Use zero address for ETH
        standard: 3, // Use 3 for ETH
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: ethers.BigNumber.from(0),
        ethPrizeAmount: ethAmount
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('ETH Giveaway raffle created successfully!');
        setFormData({
          name: '',
          ethAmount: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
        setSocialTasks([]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Feeling Generous? Now's a great time to give away some ETH!</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Total ETH Prize</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={formData.ethAmount || ''}
              onChange={e => handleChange('ethAmount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add ERC20GiveawayForm
function ERC20GiveawayForm() {
  const { connected, address, signer } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState([]);
  const [showSocialTasks, setShowSocialTasks] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tokenAddress: '',
    tokenAmount: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialTasksChange = (tasks) => {
    setSocialTasks(tasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !signer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      // Get raffleDeployer address
      const chainId = await signer.provider.getNetwork().then(net => net.chainId);
      const networkConfig = SUPPORTED_NETWORKS[chainId];
      const raffleDeployerAddress = networkConfig?.contractAddresses?.raffleDeployer;
      
      if (!raffleDeployerAddress) {
        throw new Error('RaffleDeployer address not found for current network');
      }

      // Step 1: Approve token
      console.log('Starting token approval for ERC20...');
      const approvalResult = await approveToken(
        signer,
        formData.tokenAddress,
        'erc20',
        raffleDeployerAddress,
        formData.tokenAmount,
        null
      );
      
      if (!approvalResult.success) {
        throw new Error('Token approval failed: ' + approvalResult.error);
      }
      
      console.log('Token approval successful, creating raffle...');
      // Add additional delay to ensure approval is fully processed
      console.log('Waiting additional time for approval to be fully processed...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const tokenAmount = formData.tokenAmount ? ethers.utils.parseUnits(formData.tokenAmount, 18) : ethers.BigNumber.from(0); // default 18 decimals
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ethers.BigNumber.from(0),
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero, // Use zero address for ERC20
        standard: 2, // Use 2 for ERC20
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: formData.tokenAddress,
        erc20PrizeAmount: tokenAmount,
        ethPrizeAmount: ethers.BigNumber.from(0)
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('ERC20 Giveaway raffle created successfully!');
        setFormData({
          name: '',
          tokenAddress: '',
          tokenAmount: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
        setSocialTasks([]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">It's a great day to give out some tokens! 🎁</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">ERC20 Token Address</label>
            <input
              type="text"
              value={formData.tokenAddress || ''}
              onChange={e => handleChange('tokenAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Total Token Amount</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={formData.tokenAmount || ''}
              onChange={e => handleChange('tokenAmount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Social Media Tasks Toggle */}
        <div className="flex items-center space-x-3">
          <Switch
            id="enable-social-tasks"
            checked={showSocialTasks}
            onCheckedChange={setShowSocialTasks}
          />
          <Label htmlFor="enable-social-tasks" className="text-base font-medium">
            Enable social media tasks for this raffle
          </Label>
        </div>

        {/* Social Media Tasks Section */}
        {showSocialTasks && (
          <div className="mt-8">
            {/* Placeholder for social media tasks section */}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CreateRafflePage;