import React, { useState, useEffect } from 'react';
import { Ticket, Clock, Trophy, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import { categorizeRaffles } from '../utils/raffleUtils';
import { toast } from 'sonner';

const RAFFLE_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'Activation Failed',
  'All Prizes Claimed',
  'Unengaged'
];

const RaffleCard = ({ raffle }) => {
  const navigate = useNavigate();
  const [timeLabel, setTimeLabel] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [erc20Symbol, setErc20Symbol] = useState('');
  const { getContractInstance } = useContract();
  const [ticketsSold, setTicketsSold] = useState(null);

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let label = '';
      let seconds = 0;
      if (raffle.stateNum === 2 || raffle.stateNum === 3 || raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 6 || raffle.stateNum === 7 || raffle.stateNum === 8) {
        // Ended or completed or other terminal states
        label = 'Duration';
        seconds = raffle.duration;
        setTimeLabel(label);
        setTimeRemaining(formatDuration(seconds));
        return;
      }
      if (now < raffle.startTime) {
        label = 'Starts In';
        seconds = raffle.startTime - now;
      } else {
        label = 'Ends In';
        seconds = (raffle.startTime + raffle.duration) - now;
      }
      setTimeLabel(label);
      setTimeRemaining(seconds > 0 ? formatTime(seconds) : 'Ended');
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
    function formatDuration(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      let formatted = '';
      if (days > 0) formatted += `${days}d `;
      if (hours > 0 || days > 0) formatted += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
      if (!formatted) formatted = '0m';
      return formatted.trim();
    }
    updateTimer();
    interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [raffle]);

  // ERC20 symbol lookup - optimized to reduce RPC calls
  useEffect(() => {
    let isMounted = true;
    const fetchSymbol = async () => {
      if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero) {
        // Use a static cache to avoid redundant lookups
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[raffle.erc20PrizeToken]) {
          setErc20Symbol(window.__erc20SymbolCache[raffle.erc20PrizeToken]);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const erc20Abi = ["function symbol() view returns (string)"];
          const contract = new ethers.Contract(raffle.erc20PrizeToken, erc20Abi, provider);
          const symbol = await contract.symbol();
          if (isMounted) {
            setErc20Symbol(symbol);
            window.__erc20SymbolCache[raffle.erc20PrizeToken] = symbol;
          }
        } catch (error) {
          console.warn('Failed to fetch ERC20 symbol:', error);
          if (isMounted) setErc20Symbol('TOKEN');
        }
      }
    };
    fetchSymbol();
    return () => { isMounted = false; };
  }, [raffle.erc20PrizeToken]);

  // Fetch tickets sold using the same logic as RaffleDetailPage
  useEffect(() => {
    let isMounted = true;
    async function fetchTicketsSold() {
      try {
        const raffleContract = getContractInstance && getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) {
          if (isMounted) setTicketsSold(null);
          return;
        }
        let count = 0;
        try {
          const participantsCount = await raffleContract.getParticipantsCount();
          count = participantsCount.toNumber();
        } catch (error) {
          // Fallback: count participants by iterating
          let index = 0;
          while (true) {
            try {
              await raffleContract.participants(index);
              count++;
              index++;
            } catch {
              break;
            }
          }
        }
        if (isMounted) setTicketsSold(count);
      } catch (e) {
        if (isMounted) setTicketsSold(null);
      }
    }
    fetchTicketsSold();
    // Only refetch if address changes
  }, [raffle.address, getContractInstance]);

  const getStatusBadge = () => {
    const label = RAFFLE_STATE_LABELS[raffle.stateNum] || 'Unknown';
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
      'Ended': 'bg-red-100 text-red-800',
      'Drawing': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Deleted': 'bg-gray-200 text-gray-800',
      'Activation Failed': 'bg-red-200 text-red-900',
      'All Prizes Claimed': 'bg-blue-200 text-blue-900',
      'Unengaged': 'bg-gray-100 text-gray-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return <span className={`px-2 py-1 rounded-full text-xs ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>;
  };

  const getPrizeType = () => {
    if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) return 'ETH';
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) return 'ERC20';
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) return 'NFT Prize';
    return raffle.isPrized ? 'Token Giveaway' : 'Whitelist';
  };

  const getPrizeAmount = () => {
    if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) return `${ethers.utils.formatEther(raffle.ethPrizeAmount)} ETH`;
    if (raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) return `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ${erc20Symbol || 'TOKEN'}`;
    return null;
  };

  const handleViewRaffle = () => {
    navigate(`/raffle/${raffle.address}`);
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4 hover:shadow-lg transition-shadow flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold truncate flex-1 mr-2">{raffle.name}</h3>
        {getStatusBadge()}
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Creator:</span>
          <span className="font-mono">{raffle.creator?.slice(0, 10)}...</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Ticket Price:</span>
          <span>{ethers.utils.formatEther(raffle.ticketPrice || '0')} ETH</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Tickets Sold:</span>
          <span>{ticketsSold !== null ? `${ticketsSold} / ${raffle.ticketLimit}` : 'Loading...'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Winners:</span>
          <span>{raffle.winnersCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{timeLabel}:</span>
          <span>{timeRemaining}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Type:</span>
          <span className={`px-2 py-1 rounded-full text-sm`}>{getPrizeType()}</span>
        </div>
        {(getPrizeType() === 'NFT Prize') && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Prize Collection:</span>
            <span className="font-mono">{raffle.prizeCollection?.slice(0, 10)}...</span>
          </div>
        )}
        {(getPrizeType() === 'ERC20' || getPrizeType() === 'ETH') && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Prize Amount:</span>
            <span>{getPrizeAmount()}</span>
          </div>
        )}
      </div>
      
      <Button
        onClick={handleViewRaffle}
        className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base mt-auto"
      >
        Visit Raffle Page
      </Button>
    </div>
  );
};

const RaffleSection = ({ title, raffles, icon: Icon, stateKey }) => {
  const navigate = useNavigate();
  // Reverse for newest first
  const sortedRaffles = [...raffles].reverse();
  const displayedRaffles = sortedRaffles.slice(0, 4);

  if (raffles.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </h2>
        <div className="text-center py-8 bg-background rounded-lg">
          <Icon className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No {title.toLowerCase()} at the moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title} ({raffles.length})
        </h2>
        <button
          className="text-blue-600 dark:text-blue-500 underline text-sm font-medium hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          onClick={() => navigate(`/raffles/${stateKey}`)}
        >
          View all {title.toLowerCase()}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 min-w-0">
        {displayedRaffles.map((raffle) => (
          <RaffleCard key={raffle.id} raffle={raffle} />
        ))}
      </div>
    </div>
  );
};

const LandingPage = () => {
  console.log('LandingPage component is rendering...'); // Debug log
  
  const { connected } = useWallet();
  const { contracts, getContractInstance, onContractEvent } = useContract();
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch raffles from contracts
  const fetchRaffles = React.useCallback(async (isBackground = false) => {
    if (!connected) {
      setRaffles([]);
      setError('Please connect your wallet to view raffles');
      return;
    }
    if (!contracts.raffleManager) {
      setError('Contracts not initialized. Please try refreshing the page.');
      return;
    }
    if (isBackground) {
      setBackgroundLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if (!contracts.raffleManager.getAllRaffles) {
        setError('RaffleManager contract does not support getAllRaffles.');
        setRaffles([]);
        return;
      }
      const registeredRaffles = await contracts.raffleManager.getAllRaffles();
      if (!registeredRaffles || registeredRaffles.length === 0) {
        setRaffles([]);
        setError('No raffles found on the blockchain');
        return;
      }
      
      // Limit the number of raffles to fetch to prevent rate limiting
      const maxRafflesToFetch = 20;
      const rafflesToFetch = registeredRaffles.slice(0, maxRafflesToFetch);
      
      const rafflePromises = rafflesToFetch.map(async (raffleAddress) => {
        try {
          const raffleContract = getContractInstance(raffleAddress, 'raffle');
          if (!raffleContract) {
            console.error(`Failed to get raffle contract instance for ${raffleAddress}`);
            return null;
          }
          
          // Batch all the basic raffle data calls
          const [
            name,
            creator,
            startTime,
            duration,
            ticketPrice,
            ticketLimit,
            winnersCount,
            maxTicketsPerParticipant,
            isPrized,
            prizeCollection,
            stateNum,
            erc20PrizeToken,
            erc20PrizeAmount,
            ethPrizeAmount
          ] = await Promise.all([
            raffleContract.name(),
            raffleContract.creator(),
            raffleContract.startTime(),
            raffleContract.duration(),
            raffleContract.ticketPrice(),
            raffleContract.ticketLimit(),
            raffleContract.winnersCount(),
            raffleContract.maxTicketsPerParticipant(),
            raffleContract.isPrized(),
            raffleContract.prizeCollection(),
            raffleContract.state(),
            raffleContract.erc20PrizeToken(),
            raffleContract.erc20PrizeAmount(),
            raffleContract.ethPrizeAmount()
          ]);
          
          // Skip participant count to reduce RPC calls - this was causing too many requests
          // We'll show tickets sold as "N/A" or implement a different approach later
          const ticketsSold = 0; // Temporarily set to 0 to avoid rate limiting
          
          let raffleState;
          if (stateNum === 0) { raffleState = 'pending'; }
          else if (stateNum === 1) { raffleState = 'active'; }
          else if (stateNum === 2) { raffleState = 'drawing'; }
          else if (stateNum === 3) { raffleState = 'completed'; }
          else if (stateNum === 4) { raffleState = 'completed'; }
          else if (stateNum === 5) { raffleState = 'ended'; }
          else { raffleState = 'ended'; }
          
          return {
            id: raffleAddress,
            name,
            address: raffleAddress,
            creator,
            startTime: startTime.toNumber(),
            duration: duration.toNumber(),
            ticketPrice,
            ticketLimit: ticketLimit.toNumber(),
            ticketsSold: ticketsSold,
            winnersCount: winnersCount.toNumber(),
            maxTicketsPerParticipant: maxTicketsPerParticipant.toNumber(),
            isPrized,
            prizeCollection: !!isPrized ? prizeCollection : null,
            stateNum: stateNum,
            erc20PrizeToken,
            erc20PrizeAmount,
            ethPrizeAmount
          };
        } catch (error) {
          console.error(`Error fetching raffle data for ${raffleAddress}:`, error);
          return null;
        }
      });
      
      const raffleData = await Promise.all(rafflePromises);
      const validRaffles = raffleData.filter(raffle => raffle !== null);
      setRaffles(validRaffles);
      if (validRaffles.length === 0) {
        setError('No valid raffles found on the blockchain');
      }
    } catch (error) {
      console.error('Error fetching raffles:', error);
      
      // Check if it's a rate limiting error
      if (error.message && error.message.includes('Too Many Requests')) {
        setError('Rate limit exceeded. Please wait a moment and refresh the page, or consider upgrading your RPC provider.');
      } else {
      setError('Failed to fetch raffles from blockchain. Please check your network connection and try again.');
      }
      setRaffles([]);
    } finally {
      if (isBackground) {
        setBackgroundLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [contracts, getContractInstance, connected]);

  useEffect(() => {
    fetchRaffles();
    // Increase polling interval to 2 minutes to reduce rate limiting
    const interval = setInterval(() => fetchRaffles(true), 120000);
    return () => clearInterval(interval);
  }, [fetchRaffles]);

  // Listen for contract events and refresh in background
  useEffect(() => {
    if (!onContractEvent) return;
    const unsubRaffleCreated = onContractEvent('RaffleCreated', () => {
      fetchRaffles(true);
    });
    const unsubWinnersSelected = onContractEvent('WinnersSelected', () => {
      fetchRaffles(true);
    });
    const unsubPrizeClaimed = onContractEvent('PrizeClaimed', () => {
      fetchRaffles(true);
    });
    return () => {
      unsubRaffleCreated && unsubRaffleCreated();
      unsubWinnersSelected && unsubWinnersSelected();
      unsubPrizeClaimed && unsubPrizeClaimed();
    };
  }, [onContractEvent, fetchRaffles]);

  // Categorize raffles by state and duration
  const { pending, active, ended, drawing, completed } = categorizeRaffles(raffles);

  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <PageContainer className="py-4">
        <div className="mb-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Fairness and Transparency, On-Chain</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
          </p>
        </div>
        
        <div className="text-center py-16">
          <Trophy className="h-16 w-16 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Please connect your wallet to view and interact with raffles on the blockchain.
          </p>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer className="py-8">
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Loading raffles from blockchain...</p>
        </div>
      </PageContainer>
    );
  }

  // Show error message if there's an error
  if (error) {
    return (
      <PageContainer className="py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Fairness and Transparency, On-Chain</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
          </p>
        </div>
        
        <div className="text-center py-16">
          <Trophy className="h-16 w-16 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Unable to Load Raffles</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-4 pb-16">
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold mb-4">Fairness and Transparency, On-Chain</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
        </p>
      </div>

      <div className="mt-16">
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <RaffleSection title="Active Raffles" raffles={active} icon={Clock} stateKey="active" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <RaffleSection title="Pending Raffles" raffles={pending} icon={Users} stateKey="pending" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <RaffleSection title="Drawing Phase" raffles={drawing} icon={Trophy} stateKey="drawing" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <RaffleSection title="Ended Raffles" raffles={ended} icon={Clock} stateKey="ended" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <RaffleSection title="Completed Raffles" raffles={completed} icon={Ticket} stateKey="completed" />
        </div>
      </div>

      {raffles.length === 0 && !loading && !error && (
        <div className="text-center py-16">
          <Trophy className="h-16 w-16 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Raffles Available</h3>
          <p className="text-gray-500 dark:text-gray-400">
            There are currently no raffles available on the blockchain. Check back later or create your own!
          </p>
        </div>
      )}
    </PageContainer>
  );
};

export { RaffleCard };
export default LandingPage;

