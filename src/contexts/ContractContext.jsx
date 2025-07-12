import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../networks';
import { useWallet } from './WalletContext';
import { contractABIs } from '../contracts/contractABIs';
import { toast } from "sonner";
import { formatErrorForToast } from '../utils/errorUtils';

const ContractContext = createContext();

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
};

export const ContractProvider = ({ children }) => {
  const { signer, provider, connected, chainId } = useWallet();
  const [contracts, setContracts] = useState({});

  // Initialize contracts when wallet is connected and addresses are available
  useEffect(() => {
    if (connected && signer) {
      initializeContracts();
    } else {
      setContracts({});
    }
  }, [connected, signer]);

  const initializeContracts = () => {
    const newContracts = {};

    try {
      // Initialize main contracts
      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager) {
        newContracts.raffleManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager,
          contractABIs.raffleManager,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleDeployer) {
        newContracts.raffleDeployer = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleDeployer,
          contractABIs.raffleDeployer,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.revenueManager) {
        newContracts.revenueManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.revenueManager,
          contractABIs.revenueManager,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.nftFactory) {
        newContracts.nftFactory = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.nftFactory,
          contractABIs.nftFactory,
          signer
        );
      }

      setContracts(newContracts);
    } catch (error) {
      console.error('Error initializing contracts:', error);
    }
  };

  // Create contract instance for a specific address
  const getContractInstance = (address, abiType) => {
    if (!address || !signer) return null;
    
    try {
      return new ethers.Contract(address, contractABIs[abiType], signer);
    } catch (error) {
      console.error('Error creating contract instance:', error);
      return null;
    }
  };

  // Helper function to handle contract transactions
  const executeTransaction = async (contractMethod, ...args) => {
    try {
      const tx = await contractMethod(...args);
      const receipt = await tx.wait();
      return { success: true, receipt, hash: tx.hash };
    } catch (error) {
      const message = formatErrorForToast(error);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Helper function to handle contract calls (view functions)
  const executeCall = async (contractMethod, ...args) => {
    try {
      const result = await contractMethod(...args);
      return { success: true, result };
    } catch (error) {
      const message = formatErrorForToast(error);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Add event subscription system
  const eventListeners = React.useRef({});

  // Helper to register event listeners
  const onContractEvent = (event, callback) => {
    if (!eventListeners.current[event]) {
      eventListeners.current[event] = [];
    }
    eventListeners.current[event].push(callback);
    // Return unsubscribe function
    return () => {
      eventListeners.current[event] = eventListeners.current[event].filter(cb => cb !== callback);
    };
  };

  // Emit event to all listeners
  const emitEvent = (event, ...args) => {
    if (eventListeners.current[event]) {
      eventListeners.current[event].forEach(cb => cb(...args));
    }
  };

  // Set up contract event listeners
  useEffect(() => {
    if (!connected || !signer || !contracts.raffleDeployer) return;

    // --- RaffleCreated ---
    const handleRaffleCreated = (raffle, creator) => {
      emitEvent('RaffleCreated', { raffle, creator });
    };
    contracts.raffleDeployer.on('RaffleCreated', handleRaffleCreated);

    // --- WinnersSelected ---
    if (contracts.raffle) {
      const handleWinnersSelected = (winners) => {
        emitEvent('WinnersSelected', { winners });
      };
      contracts.raffle.on('WinnersSelected', handleWinnersSelected);

      // --- PrizeClaimed ---
      const handlePrizeClaimed = (winner, tokenId) => {
        emitEvent('PrizeClaimed', { winner, tokenId });
      };
      contracts.raffle.on('PrizeClaimed', handlePrizeClaimed);

      return () => {
        contracts.raffle.off('WinnersSelected', handleWinnersSelected);
        contracts.raffle.off('PrizeClaimed', handlePrizeClaimed);
      };
    }

    // Clean up
    return () => {
      contracts.raffleDeployer.off('RaffleCreated', handleRaffleCreated);
    };
  }, [connected, signer, contracts.raffleDeployer, contracts.raffle]);

  const value = {
    contracts,
    getContractInstance,
    executeTransaction,
    executeCall,
    onContractEvent,
  };

  return (
    <ContractContext.Provider value={value}>
      {children}
    </ContractContext.Provider>
  );
};


