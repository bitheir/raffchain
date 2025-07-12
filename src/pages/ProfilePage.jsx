import React, { useState, useEffect } from 'react';
import { User, Ticket, Trophy, DollarSign, Settings, Trash2, Eye, Clock, Users, Gift, Plus, Minus } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import RoyaltyAdjustmentComponent from '../components/RoyaltyAdjustmentComponent';
import CreatorRevenueWithdrawalComponent from '../components/CreatorRevenueWithdrawalComponent';
import MinterApprovalComponent from '../components/MinterApprovalComponent';
import { SUPPORTED_NETWORKS } from '../networks';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import ProfileTabs from '../components/ProfileTabs';
import { toast } from 'sonner';
import { formatErrorForToast } from '../utils/errorUtils';

function mapRaffleState(stateNum) {
  switch (stateNum) {
    case 0: return 'pending';
    case 1: return 'active';
    case 2: return 'drawing';
    case 3: return 'completed';
    case 4: return 'allPrizesClaimed';
    case 5: return 'ended';
    default: return 'unknown';
  }
}

const ActivityCard = ({ activity }) => {
  const navigate = useNavigate();
  
  const getActivityIcon = () => {
    switch (activity.type) {
      case 'ticket_purchase':
        return <Ticket className="h-5 w-5 text-blue-500" />;
      case 'raffle_created':
        return <Plus className="h-5 w-5 text-green-500" />;
      case 'raffle_deleted':
        return <Trash2 className="h-5 w-5 text-red-500" />;
      case 'prize_won':
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'prize_claimed':
        return <Gift className="h-5 w-5 text-purple-500" />;
      case 'refund_claimed':
        return <Minus className="h-5 w-5 text-orange-500" />;
      case 'revenue_withdrawn':
        return <DollarSign className="h-5 w-5 text-emerald-500" />;
      case 'admin_withdrawn':
        return <DollarSign className="h-5 w-5 text-indigo-500" />;
      case 'deletion_refund':
        return <Minus className="h-5 w-5 text-orange-500" />;
      case 'full_refund_for_deletion':
        return <Minus className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getActivityDescription = () => {
    switch (activity.type) {
      case 'ticket_purchase':
        return `Purchased ${activity.quantity} ticket(s) for ${activity.raffleName}`;
      case 'raffle_created':
        return `Created raffle "${activity.raffleName}"`;
      case 'raffle_deleted':
        return `Deleted raffle "${activity.raffleName}"`;
      case 'prize_won':
        return `Won prize in "${activity.raffleName}"`;
      case 'prize_claimed':
        return `Claimed prize from "${activity.raffleName}"`;
      case 'refund_claimed':
        return `Claimed refund for "${activity.raffleName}"`;
      case 'revenue_withdrawn':
        return `Withdrew ${ethers.utils.formatEther(activity.amount)} ETH revenue from "${activity.raffleName}"`;
      case 'admin_withdrawn':
        return `Withdrew ${ethers.utils.formatEther(activity.amount)} ETH admin revenue`;
      case 'deletion_refund':
        return `Claimed deletion refund for "${activity.raffleName}"`;
      case 'full_refund_for_deletion':
        return `Claimed full refund for "${activity.raffleName}"`;
      default:
        return activity.description;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getActivityIcon()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{getActivityDescription()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {new Date(activity.timestamp * 1000).toLocaleDateString()}
          </p>
          {activity.txHash && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
              Tx: {activity.txHash.slice(0, 10)}...
            </p>
          )}
        </div>
        {activity.raffleAddress && (
          <button
            onClick={() => navigate(`/raffle/${activity.raffleAddress}`)}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const CreatedRaffleCard = ({ raffle, onDelete, onViewRevenue }) => {
  const navigate = useNavigate();
  const { executeTransaction, getContractInstance } = useContract();
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let targetTime;
      if (raffle.state === 'pending') {
        targetTime = raffle.startTime;
        const remaining = targetTime - now;
      if (remaining > 0) {
          setTimeRemaining(formatTime(remaining));
        } else {
          // If still pending after start time, start counting down to end time
          targetTime = raffle.startTime + raffle.duration;
          const remainingToEnd = targetTime - now;
          if (remainingToEnd > 0) {
            setTimeRemaining(formatTime(remainingToEnd));
      } else {
        setTimeRemaining('Ended');
      }
        }
      } else if (raffle.state === 'active') {
        targetTime = raffle.startTime + raffle.duration;
        const remaining = targetTime - now;
        if (remaining > 0) {
          setTimeRemaining(formatTime(remaining));
        } else {
          setTimeRemaining('Ended');
        }
      } else {
        setTimeRemaining('Ended');
      }
    }
    function formatTime(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      let formatted = '';
      if (days > 0) formatted += `${days}d `;
      if (hours > 0 || days > 0) formatted += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
      formatted += `${secs}s`;
      return formatted.trim();
    }
    updateTimer();
    interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [raffle]);

  const getStatusBadge = () => {
    // Use the actual contract state instead of time-based logic
    switch (raffle.state) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>;
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>;
      case 'drawing':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Drawing</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Completed</span>;
      case 'ended':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Ended</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">Unknown</span>;
    }
  };

  const canDelete = () => {
    // Updated logic: Raffles can now be deleted even after tickets have been sold
    // The contract will handle refunds automatically
    return raffle.state === 'pending' || raffle.state === 'active';
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold truncate">{raffle.name}</h3>
        {getStatusBadge()}
      </div>
      
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Tickets Sold:</span>
          <span>{raffle.ticketsSold} / {raffle.ticketLimit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Revenue:</span>
          <span>{ethers.utils.formatEther(raffle.totalRevenue || '0')} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Time:</span>
          <span>{timeRemaining}</span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={() => navigate(`/raffle/${raffle.address}`)}
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-md hover:from-blue-600 hover:to-purple-700 transition-colors text-sm"
        >
          View
        </Button>
        {raffle.totalRevenue && parseFloat(ethers.utils.formatEther(raffle.totalRevenue)) > 0 && (
          <Button
            onClick={() => onViewRevenue(raffle)}
            className="px-3 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-md hover:from-green-600 hover:to-teal-700 transition-colors text-sm"
          >
            Revenue
          </Button>
        )}
        {canDelete() && (
          <Button
            onClick={() => onDelete(raffle)}
            className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-md hover:from-red-600 hover:to-pink-700 transition-colors text-sm font-medium"
            title={raffle.ticketsSold > 0 ? "Delete raffle (refunds will be processed automatically)" : "Delete this raffle"}
          >
            Delete
          </Button>
        )}
        {/* Mint to Winner button for creator */}
        {raffle.isCreator && (
          <Button
            onClick={async () => {
              try {
                const raffleContract = getContractInstance(raffle.address, 'raffle');
                if (!raffleContract) throw new Error('Failed to get raffle contract');
                const result = await executeTransaction(raffleContract.mintToWinner);
                if (result.success) {
                  toast.success('mintToWinner() executed successfully!');
                  window.location.reload();
                } else {
                  throw new Error(result.error);
                }
              } catch (err) {
                toast.error('mintToWinner failed: ' + err.message);
              }
            }}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base"
          >
            Mint to Winner
          </Button>
        )}
      </div>
      
      {/* Show deletion info for raffles with sold tickets */}
      {canDelete() && raffle.ticketsSold > 0 && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <p>ℹ️ Deletion will automatically process refunds for sold tickets</p>
        </div>
      )}
      
      {/* Show info for non-deletable raffles */}
      {!canDelete() && (
        <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800">
          <p>⚠️ Cannot delete: Raffle is not in pending or active state</p>
        </div>
      )}
    </div>
  );
};

const PurchasedTicketsCard = ({ ticket, onClaimPrize, onClaimRefund }) => {
  const navigate = useNavigate();
  
  const canClaimPrize = () => {
    return ticket.isWinner && (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') && !ticket.prizeClaimed;
  };

  const canClaimRefund = () => {
    return !ticket.isWinner && (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') && !ticket.refundClaimed;
  };
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold truncate">{ticket.raffleName}</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">{ticket.quantity} tickets</span>
      </div>
      
      <div className="space-y-1 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Total Cost:</span>
          <span>{ethers.utils.formatEther(ticket.totalCost)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Purchase Date:</span>
          <span>{new Date(ticket.purchaseDate * 1000).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">State:</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            ticket.raffleState === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            ticket.raffleState === 'active' ? 'bg-green-100 text-green-800' :
            ticket.raffleState === 'drawing' ? 'bg-purple-100 text-purple-800' :
            ticket.raffleState === 'completed' ? 'bg-blue-100 text-blue-800' :
            ticket.raffleState === 'allPrizesClaimed' ? 'bg-blue-100 text-blue-800' :
            ticket.raffleState === 'ended' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {ticket.raffleState.charAt(0).toUpperCase() + ticket.raffleState.slice(1)}
          </span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/raffle/${ticket.raffleAddress}`)}
          className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white px-3 py-2 rounded-md hover:from-gray-600 hover:to-gray-700 transition-colors text-sm"
        >
          Visit Raffle Page
        </button>
        
        {canClaimPrize() && (
          <button
            onClick={() => onClaimPrize(ticket)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2 rounded-md hover:from-green-600 hover:to-emerald-700 transition-colors text-sm"
          >
            Claim Prize
          </button>
        )}
        
        {canClaimRefund() && (
          <button
            onClick={() => onClaimRefund(ticket)}
            className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-3 py-2 rounded-md hover:from-orange-600 hover:to-amber-700 transition-colors text-sm"
          >
            Claim Refund
          </button>
        )}
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { connected, address, provider, chainId } = useWallet();
  const { contracts, getContractInstance, executeTransaction, executeCall } = useContract();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('activity');
  const [userActivity, setUserActivity] = useState([]);
  const [createdRaffles, setCreatedRaffles] = useState([]);
  const [purchasedTickets, setPurchasedTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [activityStats, setActivityStats] = useState({
    totalTicketsPurchased: 0,
    totalRafflesCreated: 0,
    totalPrizesWon: 0,
    totalRevenueWithdrawn: '0',
    totalRefundsClaimed: 0
  });

  // Fetch on-chain activity
  const fetchOnChainActivity = async () => {
    if (!connected || !address || !provider) return;

    setLoading(true);
    try {
      const activities = [];
      const currentBlock = await provider.getBlockNumber();
      // Increase block range to capture more events
      const fromBlock = Math.max(0, currentBlock - 50000); // Last 50k blocks instead of 10k

      console.log('Fetching activity from block', fromBlock, 'to', currentBlock);

      // 1. Fetch RaffleCreated events from RaffleDeployer
      if (contracts.raffleDeployer) {
        try {
          const raffleCreatedFilter = contracts.raffleDeployer.filters.RaffleCreated(null, address);
          const raffleCreatedEvents = await contracts.raffleDeployer.queryFilter(raffleCreatedFilter, fromBlock);
          
          console.log('Found', raffleCreatedEvents.length, 'RaffleCreated events for address:', address);
          
          // If no events found, try from an even earlier block
          if (raffleCreatedEvents.length === 0) {
            const earlierFromBlock = Math.max(0, currentBlock - 100000); // Last 100k blocks
            console.log('No events found, trying from block', earlierFromBlock);
            const earlierEvents = await contracts.raffleDeployer.queryFilter(raffleCreatedFilter, earlierFromBlock);
            console.log('Found', earlierEvents.length, 'events from earlier block range');
            raffleCreatedEvents.push(...earlierEvents);
          }
          
          for (const event of raffleCreatedEvents) {
            const block = await provider.getBlock(event.blockNumber);
            try {
              // Try to get the actual raffle name
              const raffleContract = getContractInstance(event.args.raffle, 'raffle');
              let raffleName = `Raffle ${event.args.raffle.slice(0, 8)}...`;
              
              if (raffleContract) {
                const nameResult = await executeCall(raffleContract.name);
                if (nameResult.success) {
                  raffleName = nameResult.result;
                }
              }
              
              activities.push({
                type: 'raffle_created',
                raffleAddress: event.args.raffle,
                raffleName: raffleName,
                timestamp: block.timestamp,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber
              });
            } catch (error) {
              console.error('Error processing RaffleCreated event:', error);
              // Still add the activity with fallback name
              activities.push({
                type: 'raffle_created',
                raffleAddress: event.args.raffle,
                raffleName: `Raffle ${event.args.raffle.slice(0, 8)}...`,
                timestamp: block.timestamp,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber
              });
            }
          }
        } catch (error) {
          console.error('Error fetching RaffleCreated events:', error);
        }
      }

      // 2. Fetch TicketsPurchased events from all raffles
      if (contracts.raffleManager) {
        try {
          // Get all registered raffles
          const raffleRegisteredFilter = contracts.raffleManager.filters.RaffleRegistered();
          const raffleRegisteredEvents = await contracts.raffleManager.queryFilter(raffleRegisteredFilter, fromBlock);
          
          console.log('Found', raffleRegisteredEvents.length, 'registered raffles');
          
          for (const event of raffleRegisteredEvents) {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');
            
            if (raffleContract) {
              try {
                // Fetch ticket purchases for this raffle
                const ticketsPurchasedFilter = raffleContract.filters.TicketsPurchased(address);
                const ticketEvents = await raffleContract.queryFilter(ticketsPurchasedFilter, fromBlock);
                
                for (const ticketEvent of ticketEvents) {
                  const block = await provider.getBlock(ticketEvent.blockNumber);
                  try {
                    const [
                      name,
                      ticketPrice,
                      stateNum,
                      isWinner,
                      prizeClaimed,
                      refundClaimed,
                      prizeCollection,
                      isPrizedContract
                    ] = await Promise.all([
                      executeCall(raffleContract.name),
                      executeCall(raffleContract.ticketPrice),
                      executeCall(raffleContract.state),
                      executeCall(raffleContract.isWinner, address),
                      executeCall(raffleContract.prizeClaimed, address),
                      executeCall(raffleContract.refundClaimed, address),
                      executeCall(raffleContract.prizeCollection),
                      executeCall(raffleContract.isPrized)
                    ]);

                    const isPrized = !!isPrizedContract.success && isPrizedContract.result;
                    let mappedState = stateNum.success ? mapRaffleState(stateNum.result) : 'unknown';
                    if (!isPrized && mappedState === 'allPrizesClaimed') {
                      mappedState = 'completed';
                    }

                    const quantity = ticketEvent.args.quantity.toNumber();
                    const totalCost = ticketPrice.success ? 
                      ticketPrice.result.mul(quantity) : 
                      ethers.BigNumber.from(0);

                    activities.push({
                      type: 'ticket_purchase',
                      raffleAddress: raffleAddress,
                      raffleName: name.result,
                      quantity: quantity,
                      totalCost: totalCost,
                      purchaseDate: (await provider.getBlock(ticketEvent.blockNumber)).timestamp,
                      isWinner: isWinner.success ? isWinner.result : false,
                      raffleState: mappedState,
                      prizeClaimed: prizeClaimed.success ? prizeClaimed.result : false,
                      refundClaimed: refundClaimed.success ? refundClaimed.result : false,
                      isPrized
                    });
                  } catch (error) {
                    console.error('Error fetching ticket details:', error);
                  }
                }

                // Fetch prize claims for this raffle
                const prizeClaimedFilter = raffleContract.filters.PrizeClaimed(address);
                const prizeEvents = await raffleContract.queryFilter(prizeClaimedFilter, fromBlock);
                
                for (const prizeEvent of prizeEvents) {
                  const block = await provider.getBlock(prizeEvent.blockNumber);
                  try {
                    const raffleInfo = await executeCall(raffleContract.name);
                    activities.push({
                      type: 'prize_claimed',
                      raffleAddress: raffleAddress,
                      raffleName: raffleInfo.success ? raffleInfo.result : `Raffle ${raffleAddress.slice(0, 8)}...`,
                      tokenId: prizeEvent.args.tokenId.toString(),
                      timestamp: block.timestamp,
                      txHash: prizeEvent.transactionHash,
                      blockNumber: prizeEvent.blockNumber
                    });
                  } catch (error) {
                    console.error('Error fetching raffle name for prize:', error);
                  }
                }

                // Fetch revenue withdrawals for this raffle
                const revenueWithdrawnFilter = raffleContract.filters.RevenueWithdrawn(address);
                const revenueEvents = await raffleContract.queryFilter(revenueWithdrawnFilter, fromBlock);
                
                for (const revenueEvent of revenueEvents) {
                  const block = await provider.getBlock(revenueEvent.blockNumber);
                  try {
                    const raffleInfo = await executeCall(raffleContract.name);
                    activities.push({
                      type: 'revenue_withdrawn',
                      raffleAddress: raffleAddress,
                      raffleName: raffleInfo.success ? raffleInfo.result : `Raffle ${raffleAddress.slice(0, 8)}...`,
                      amount: revenueEvent.args.amount,
                      timestamp: block.timestamp,
                      txHash: revenueEvent.transactionHash,
                      blockNumber: revenueEvent.blockNumber
                    });
                  } catch (error) {
                    console.error('Error fetching raffle name for revenue:', error);
                  }
                }

                // Fetch raffle deletions
                const raffleDeletedFilter = raffleContract.filters.RaffleDeleted();
                const deletedEvents = await raffleContract.queryFilter(raffleDeletedFilter, fromBlock);
                
                for (const deletedEvent of deletedEvents) {
                  const block = await provider.getBlock(deletedEvent.blockNumber);
                  try {
                    const raffleInfo = await executeCall(raffleContract.name);
                    activities.push({
                      type: 'raffle_deleted',
                      raffleAddress: raffleAddress,
                      raffleName: raffleInfo.success ? raffleInfo.result : `Raffle ${raffleAddress.slice(0, 8)}...`,
                      timestamp: block.timestamp,
                      txHash: deletedEvent.transactionHash,
                      blockNumber: deletedEvent.blockNumber
                    });
                  } catch (error) {
                    console.error('Error fetching raffle name for deletion:', error);
                  }
                }

                // Fetch deletion refunds for this raffle
                const deletionRefundFilter = raffleContract.filters.DeletionRefund(address);
                const deletionRefundEvents = await raffleContract.queryFilter(deletionRefundFilter, fromBlock);
                for (const refundEvent of deletionRefundEvents) {
                  const block = await provider.getBlock(refundEvent.blockNumber);
                  try {
                    const raffleInfo = await executeCall(raffleContract.name);
                    activities.push({
                      type: 'refund_claimed',
                      raffleAddress: raffleAddress,
                      raffleName: raffleInfo.success ? raffleInfo.result : `Raffle ${raffleAddress.slice(0, 8)}...`,
                      amount: refundEvent.args.amount,
                      timestamp: block.timestamp,
                      txHash: refundEvent.transactionHash,
                      blockNumber: refundEvent.blockNumber
                    });
                  } catch (error) {
                    // fallback
                    activities.push({
                      type: 'refund_claimed',
                      raffleAddress: raffleAddress,
                      raffleName: `Raffle ${raffleAddress.slice(0, 8)}...`,
                      amount: refundEvent.args.amount,
                      timestamp: block.timestamp,
                      txHash: refundEvent.transactionHash,
                      blockNumber: refundEvent.blockNumber
                    });
                  }
                }

                // Fetch full refunds for deletion for this raffle
                const fullRefundForDeletionFilter = raffleContract.filters.FullRefundForDeletion(address);
                const fullRefundEvents = await raffleContract.queryFilter(fullRefundForDeletionFilter, fromBlock);
                for (const refundEvent of fullRefundEvents) {
                  const block = await provider.getBlock(refundEvent.blockNumber);
                  try {
                    const raffleInfo = await executeCall(raffleContract.name);
                    activities.push({
                      type: 'refund_claimed',
                      raffleAddress: raffleAddress,
                      raffleName: raffleInfo.success ? raffleInfo.result : `Raffle ${raffleAddress.slice(0, 8)}...`,
                      amount: refundEvent.args.amount,
                      timestamp: block.timestamp,
                      txHash: refundEvent.transactionHash,
                      blockNumber: refundEvent.blockNumber
                    });
                  } catch (error) {
                    activities.push({
                      type: 'refund_claimed',
                      raffleAddress: raffleAddress,
                      raffleName: `Raffle ${raffleAddress.slice(0, 8)}...`,
                      amount: refundEvent.args.amount,
                      timestamp: block.timestamp,
                      txHash: refundEvent.transactionHash,
                      blockNumber: refundEvent.blockNumber
                    });
                  }
                }
              } catch (error) {
                console.error('Error processing raffle events:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching raffle manager events:', error);
        }
      }

      // 3. Fetch AdminWithdrawn events from RevenueManager
      if (contracts.revenueManager) {
        try {
          const adminWithdrawnFilter = contracts.revenueManager.filters.AdminWithdrawn(address);
          const adminWithdrawnEvents = await contracts.revenueManager.queryFilter(adminWithdrawnFilter, fromBlock);
          
          for (const event of adminWithdrawnEvents) {
            const block = await provider.getBlock(event.blockNumber);
            activities.push({
              type: 'admin_withdrawn',
              amount: event.args.amount,
              timestamp: block.timestamp,
              txHash: event.transactionHash,
              blockNumber: event.blockNumber
            });
          }
        } catch (error) {
          console.error('Error fetching AdminWithdrawn events:', error);
        }
      }

      // Sort activities by timestamp (newest first)
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setUserActivity(activities);

      console.log('Total activities found:', activities.length);
      console.log('Activity breakdown:', {
        raffle_created: activities.filter(a => a.type === 'raffle_created').length,
        ticket_purchase: activities.filter(a => a.type === 'ticket_purchase').length,
        prize_claimed: activities.filter(a => a.type === 'prize_claimed').length,
        revenue_withdrawn: activities.filter(a => a.type === 'revenue_withdrawn').length,
        raffle_deleted: activities.filter(a => a.type === 'raffle_deleted').length,
        admin_withdrawn: activities.filter(a => a.type === 'admin_withdrawn').length,
        deletion_refund: activities.filter(a => a.type === 'refund_claimed').length,
        full_refund_for_deletion: activities.filter(a => a.type === 'refund_claimed').length
      });

      // Calculate activity stats
      const stats = {
        totalTicketsPurchased: activities.filter(a => a.type === 'ticket_purchase').length,
        totalRafflesCreated: activities.filter(a => a.type === 'raffle_created').length,
        totalPrizesWon: activities.filter(a => a.type === 'prize_claimed').length,
        totalRevenueWithdrawn: activities
          .filter(a => a.type === 'revenue_withdrawn' || a.type === 'admin_withdrawn')
          .reduce((sum, a) => sum.add(a.amount), ethers.BigNumber.from(0))
          .toString(),
        totalRefundsClaimed: activities.filter(a => a.type === 'refund_claimed').length
      };
      setActivityStats(stats);

    } catch (error) {
      console.error('Error fetching on-chain activity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch created raffles
  const fetchCreatedRaffles = async () => {
    if (!connected || !address || !contracts.raffleManager) return;

    try {
      const raffles = [];
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Use same extended range

      console.log('Fetching created raffles from block', fromBlock, 'to', currentBlock);

      // Get all RaffleCreated events for this user
      const raffleCreatedFilter = contracts.raffleDeployer.filters.RaffleCreated(null, address);
      const raffleCreatedEvents = await contracts.raffleDeployer.queryFilter(raffleCreatedFilter, fromBlock);

      console.log('Found', raffleCreatedEvents.length, 'RaffleCreated events for user:', address);

      // If no events found, try from an even earlier block
      if (raffleCreatedEvents.length === 0) {
        const earlierFromBlock = Math.max(0, currentBlock - 100000); // Last 100k blocks
        console.log('No raffles found, trying from block', earlierFromBlock);
        const earlierEvents = await contracts.raffleDeployer.queryFilter(raffleCreatedFilter, earlierFromBlock);
        console.log('Found', earlierEvents.length, 'raffles from earlier block range');
        raffleCreatedEvents.push(...earlierEvents);
      }

      for (const event of raffleCreatedEvents) {
        const raffleAddress = event.args.raffle;
        console.log('Processing raffle:', raffleAddress);
        
        const raffleContract = getContractInstance(raffleAddress, 'raffle');
        
        if (raffleContract) {
          try {
            const [name, startTime, duration, ticketLimit, ticketsSold, state, totalRevenue] = await Promise.all([
              executeCall(raffleContract.name),
              executeCall(raffleContract.startTime),
              executeCall(raffleContract.duration),
              executeCall(raffleContract.ticketLimit),
              executeCall(raffleContract.ticketsSold),
              executeCall(raffleContract.state),
              executeCall(raffleContract.totalRevenue)
            ]);

            if (name.success) {
              const raffleData = {
                id: raffleAddress,
                name: name.result,
                address: raffleAddress,
                startTime: startTime.success ? startTime.result.toNumber() : 0,
                duration: duration.success ? duration.result.toNumber() : 0,
                ticketLimit: ticketLimit.success ? ticketLimit.result.toNumber() : 0,
                ticketsSold: ticketsSold.success ? ticketsSold.result.toNumber() : 0,
                totalRevenue: totalRevenue.success ? totalRevenue.result : ethers.BigNumber.from(0),
                state: state.success ? mapRaffleState(state.result) : 'unknown'
              };
              
              console.log('Successfully fetched raffle data:', raffleData);
              raffles.push(raffleData);
            } else {
              console.error('Failed to fetch raffle name for:', raffleAddress);
            }
          } catch (error) {
            console.error('Error fetching raffle details for', raffleAddress, ':', error);
          }
        } else {
          console.error('Failed to create contract instance for raffle:', raffleAddress);
        }
      }

      console.log('Total created raffles found:', raffles.length);
      setCreatedRaffles(raffles);
    } catch (error) {
      console.error('Error fetching created raffles:', error);
    }
  };

  // Fetch purchased tickets
  const fetchPurchasedTickets = async () => {
    if (!connected || !address || !contracts.raffleManager) return;

    try {
      const tickets = [];
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);

      // Get all registered raffles
      const raffleRegisteredFilter = contracts.raffleManager.filters.RaffleRegistered();
      const raffleRegisteredEvents = await contracts.raffleManager.queryFilter(raffleRegisteredFilter, fromBlock);

      for (const event of raffleRegisteredEvents) {
        const raffleAddress = event.args.raffle;
        const raffleContract = getContractInstance(raffleAddress, 'raffle');
        
        if (raffleContract) {
          // Get ticket purchases for this user
          const ticketsPurchasedFilter = raffleContract.filters.TicketsPurchased(address);
          const ticketEvents = await raffleContract.queryFilter(ticketsPurchasedFilter, fromBlock);

          for (const ticketEvent of ticketEvents) {
            try {
              const [
                name,
                ticketPrice,
                stateNum,
                isWinner,
                prizeClaimed,
                refundClaimed,
                prizeCollection,
                isPrizedContract
              ] = await Promise.all([
                executeCall(raffleContract.name),
                executeCall(raffleContract.ticketPrice),
                executeCall(raffleContract.state),
                executeCall(raffleContract.isWinner, address),
                executeCall(raffleContract.prizeClaimed, address),
                executeCall(raffleContract.refundClaimed, address),
                executeCall(raffleContract.prizeCollection),
                executeCall(raffleContract.isPrized)
              ]);

              const isPrized = !!isPrizedContract.success && isPrizedContract.result;
              let mappedState = stateNum.success ? mapRaffleState(stateNum.result) : 'unknown';
              if (!isPrized && mappedState === 'allPrizesClaimed') {
                mappedState = 'completed';
              }

              if (name.success) {
                const quantity = ticketEvent.args.quantity.toNumber();
                const totalCost = ticketPrice.success ? 
                  ticketPrice.result.mul(quantity) : 
                  ethers.BigNumber.from(0);

                tickets.push({
                  id: `${raffleAddress}-${ticketEvent.transactionHash}`,
                  raffleName: name.result,
                  raffleAddress: raffleAddress,
                  quantity: quantity,
                  totalCost: totalCost,
                  purchaseDate: (await provider.getBlock(ticketEvent.blockNumber)).timestamp,
                  isWinner: isWinner.success ? isWinner.result : false,
                  raffleState: mappedState,
                  prizeClaimed: prizeClaimed.success ? prizeClaimed.result : false,
                  refundClaimed: refundClaimed.success ? refundClaimed.result : false,
                  isPrized
                });
              }
            } catch (error) {
              console.error('Error fetching ticket details:', error);
            }
          }
        }
      }

      setPurchasedTickets(tickets);
    } catch (error) {
      console.error('Error fetching purchased tickets:', error);
    }
  };

  // Load data when wallet connects
  useEffect(() => {
    if (connected && address) {
      fetchOnChainActivity();
      fetchCreatedRaffles();
      fetchPurchasedTickets();
    }
  }, [connected, address, contracts]);

  const handleDeleteRaffle = async (raffle) => {
    let confirmMessage = `Are you sure you want to delete "${raffle.name}"?`;
    
    if (raffle.ticketsSold > 0) {
      confirmMessage += `\n\nThis raffle has ${raffle.ticketsSold} sold tickets. Deletion will automatically process refunds for all participants.`;
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) {
        throw new Error('Failed to get raffle contract');
      }

      const result = await executeTransaction(raffleContract.deleteRaffle);
      
      if (result.success) {
        const successMessage = raffle.ticketsSold > 0 
          ? `Raffle deleted successfully! Refunds have been processed automatically for ${raffle.ticketsSold} sold tickets.`
          : 'Raffle deleted successfully!';
        toast.success(successMessage);
        // Refresh data after deletion
        setLoading(true);
        await Promise.all([
          fetchOnChainActivity(),
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting raffle:', error);
        toast.error(formatErrorForToast(error));
    }
  };

  const handleViewRevenue = (raffle) => {
    setSelectedRaffle(raffle);
    setShowRevenueModal(true);
  };

  const handleClaimPrize = async (ticket) => {
    try {
      const raffleContract = getContractInstance(ticket.raffleAddress, 'raffle');
      if (!raffleContract) {
        throw new Error('Failed to get raffle contract');
      }

      let result;
      if (ticket.prizeAmount > 1) {
        // Multiple prizes - use claimPrizes
        result = await executeTransaction(raffleContract.claimPrizes, ticket.prizeAmount);
      } else {
        // Single prize - use claimPrize
        result = await executeTransaction(raffleContract.claimPrize);
      }
      
      if (result.success) {
        toast.success('Prize claimed successfully!');
        // Refresh data after claiming
        setLoading(true);
        await Promise.all([
          fetchOnChainActivity(),
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error claiming prize:', error);
      toast.error(formatErrorForToast(error));
    }
  };

  const handleClaimRefund = async (ticket) => {
    try {
      const raffleContract = getContractInstance(ticket.raffleAddress, 'raffle');
      if (!raffleContract) {
        throw new Error('Failed to get raffle contract');
      }

      const refundClaimed = await raffleContract.refundedNonWinningTickets(address);
      const refundClaimedBool = refundClaimed && refundClaimed.gt && refundClaimed.gt(0);

      const result = await executeTransaction(raffleContract.claimRefund);
      
      if (result.success) {
        toast.success('Refund claimed successfully!');
        // Refresh data after claiming
        setLoading(true);
        await Promise.all([
          fetchOnChainActivity(),
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error claiming refund:', error);
      toast.error(formatErrorForToast(error));
    }
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile and activity.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'created', label: 'Created Raffles', icon: Users },
    { id: 'tickets', label: 'Purchased Tickets', icon: Ticket },
    { id: 'collections', label: 'Creator Dashboard', icon: Settings }
  ];

  return (
    <PageContainer variant="profile" className="pb-16">
      <PageContainer variant="profile" className="py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Profile</h1>
              <p className="text-muted-foreground">
                Track activities, manage your raffles, revenue and collections
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-medium">Connected Account:</p>
            <p className="font-mono text-sm">{address}</p>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Activity Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Ticket className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{activityStats.totalTicketsPurchased}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tickets Purchased</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Plus className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{activityStats.totalRafflesCreated}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Raffles Created</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{activityStats.totalPrizesWon}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Prizes Won</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{parseFloat(ethers.utils.formatEther(activityStats.totalRevenueWithdrawn)).toFixed(4)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ETH Withdrawn</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Minus className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{activityStats.totalRefundsClaimed}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Refunds Claimed</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <ProfileTabs
            activities={userActivity}
            createdRaffles={createdRaffles}
            purchasedTickets={purchasedTickets}
            creatorStats={{
              totalRaffles: createdRaffles.length,
              activeRaffles: createdRaffles.filter(r => r.state === 'active').length,
              totalRevenue: createdRaffles.reduce((sum, r) => sum + (r.ticketsSold * parseFloat(r.ticketPrice) / 1e18), 0).toFixed(4),
              monthlyRevenue: '0.0000', // TODO: Calculate monthly revenue
              totalParticipants: createdRaffles.reduce((sum, r) => sum + r.ticketsSold, 0),
              uniqueParticipants: createdRaffles.reduce((sum, r) => sum + r.ticketsSold, 0), // TODO: Calculate unique participants
              successRate: createdRaffles.length > 0 ? 
                Math.round((createdRaffles.filter(r => r.state === 'completed').length / createdRaffles.length) * 100) : 0
            }}
            onDeleteRaffle={handleDeleteRaffle}
                        onViewRevenue={handleViewRevenue}
                        onClaimPrize={handleClaimPrize}
                        onClaimRefund={handleClaimRefund}
                      />
        )}

        {/* Revenue Modal */}
        {showRevenueModal && selectedRaffle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Revenue Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Raffle:</span>
                  <span className="font-medium">{selectedRaffle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Revenue:</span>
                  <span className="font-medium">{ethers.utils.formatEther(selectedRaffle.totalRevenue)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tickets Sold:</span>
                  <span className="font-medium">{selectedRaffle.ticketsSold}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRevenueModal(false)}
                  className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-md hover:from-gray-600 hover:to-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Handle revenue withdrawal
                    setShowRevenueModal(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-md hover:from-green-600 hover:to-teal-700 transition-colors"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageContainer>
  );
};

export default ProfilePage;

