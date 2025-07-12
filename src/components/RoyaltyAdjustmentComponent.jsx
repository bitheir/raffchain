import React, { useState, useEffect } from 'react';
import { Settings, Search, AlertCircle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { formatErrorForToast } from '../utils/errorUtils';

const RoyaltyAdjustmentComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: '',
    type: 'erc721', // erc721 or erc1155
    royaltyPercentage: '',
    royaltyRecipient: ''
  });
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const handleChange = (field, value) => {
    setCollectionData(prev => ({ ...prev, [field]: value }));
  };

  const loadCollectionInfo = async () => {
    if (!collectionData.address || !connected) {
      toast.error('Please enter a collection address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      const contractType = collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(collectionData.address, contractType);
      
      if (!contract) {
        throw new Error('Failed to create contract instance');
      }

      // Get current royalty info
      const royaltyInfo = await contract.royaltyInfo(1, 10000); // Query with token ID 1 and sale price 10000
      const royaltyPercentage = await contract.royaltyPercentage();
      const royaltyRecipient = await contract.royaltyRecipient();

      // Check if current user is the owner (for permission validation)
      let isOwner = false;
      try {
        const owner = await contract.owner();
        isOwner = owner.toLowerCase() === address.toLowerCase();
      } catch (error) {
        console.warn('Could not check ownership:', error);
      }

      setCollectionInfo({
        address: collectionData.address,
        type: collectionData.type,
        currentRoyaltyPercentage: royaltyPercentage.toString(),
        currentRoyaltyRecipient: royaltyRecipient,
        royaltyAmount: royaltyInfo[1].toString(),
        isOwner
      });

      // Pre-fill form with current values
      setCollectionData(prev => ({
        ...prev,
        royaltyPercentage: (royaltyPercentage.toNumber() / 100).toString(),
        royaltyRecipient: royaltyRecipient
      }));

          } catch (error) {
        console.error('Error loading collection info:', error);
        toast.error(formatErrorForToast(error));
        setCollectionInfo(null);
      } finally {
      setLoadingInfo(false);
    }
  };

  const handleUpdateRoyalty = async () => {
    if (!connected || !collectionInfo) {
      toast.error('Please connect your wallet and load collection info first');
      return;
    }

    if (!collectionInfo.isOwner) {
      toast.error('You are not the owner of this collection');
      return;
    }

    const royaltyPercentage = parseFloat(collectionData.royaltyPercentage);
    if (isNaN(royaltyPercentage) || royaltyPercentage < 0 || royaltyPercentage > 10) {
      toast.error('Please enter a valid royalty percentage (0-10%)');
      return;
    }

    if (!collectionData.royaltyRecipient) {
      toast.error('Please enter a royalty recipient address');
      return;
    }

    setLoading(true);
    try {
      const contractType = collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(collectionData.address, contractType);
      
      if (!contract) {
        throw new Error('Failed to create contract instance');
      }

      // Convert percentage to basis points (multiply by 100)
      const royaltyBasisPoints = Math.floor(royaltyPercentage * 100);

      const result = await executeTransaction(
        contract.setRoyalty,
        royaltyBasisPoints,
        collectionData.royaltyRecipient
      );

      if (result.success) {
        toast.success(`Royalty updated successfully! Transaction: ${result.hash}`);
        // Reload collection info to show updated values
        await loadCollectionInfo();
      } else {
        throw new Error(result.error);
      }
          } catch (error) {
        console.error('Error updating royalty:', error);
        toast.error(formatErrorForToast(error));
      } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Adjust Collection Royalties</h3>
      </div>

      <div className="space-y-6">
        {/* Collection Lookup Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Collection Address</label>
              <input
                type="text"
                value={collectionData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Collection Type</label>
              <select
                value={collectionData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
              >
                <option value="erc721">ERC721</option>
                <option value="erc1155">ERC1155</option>
              </select>
            </div>
          </div>

          <button
            onClick={loadCollectionInfo}
            disabled={loadingInfo || !connected}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loadingInfo ? 'Loading...' : 'Load Collection Info'}
          </button>
        </div>

        {/* Collection Info Display */}
        {collectionInfo && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-3">Collection Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="font-mono break-all">{collectionInfo.address}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <div className="uppercase">{collectionInfo.type}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Current Royalty:</span>
                <div>{(parseInt(collectionInfo.currentRoyaltyPercentage) / 100).toFixed(2)}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Current Recipient:</span>
                <div className="font-mono break-all">{collectionInfo.currentRoyaltyRecipient}</div>
              </div>
            </div>
            
            {!collectionInfo.isOwner && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the owner of this collection and cannot modify royalties.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Royalty Update Form */}
        {collectionInfo && collectionInfo.isOwner && (
          <div className="space-y-4">
            <h4 className="font-semibold">Update Royalty Settings</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Royalty Percentage (0-10%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={collectionData.royaltyPercentage}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Royalty Recipient
                </label>
                <input
                  type="text"
                  value={collectionData.royaltyRecipient}
                  onChange={(e) => handleChange('royaltyRecipient', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  placeholder="0x..."
                />
              </div>
            </div>

            <button
              onClick={handleUpdateRoyalty}
              disabled={loading || !connected}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {loading ? 'Updating...' : 'Update Royalty Settings'}
            </button>
          </div>
        )}

        {!connected && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Please connect your wallet to manage collection royalties.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoyaltyAdjustmentComponent;

