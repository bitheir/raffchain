import React, { useState } from 'react';
import { Package, ArrowLeft, Coins } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { formatErrorForToast } from '../utils/errorUtils';
import { PageContainer } from '../components/Layout';

const DeployERC1155CollectionPage = () => {
  const { connected } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [deployedCollection, setDeployedCollection] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: ''
  });
  const [mintData, setMintData] = useState({
    collectionAddress: '',
    tokenId: '',
    amount: '',
    recipientAddress: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMintChange = (field, value) => {
    setMintData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.nftFactory) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.nftFactory.deployERC1155Collection,
        formData.name,
        formData.symbol,
        formData.baseURI,
        parseInt(formData.maxSupply),
        parseInt(formData.royaltyPercentage || '0')
      );

      if (result.success) {
        toast.success('ERC1155 collection deployed successfully!');
        // Set the deployed collection address for minting
        setDeployedCollection(result.receipt.logs[0].address || '');
        setMintData(prev => ({ ...prev, collectionAddress: result.receipt.logs[0].address || '' }));
        // Reset form
        setFormData({
          name: '',
          symbol: '',
          baseURI: '',
          maxSupply: '',
          royaltyPercentage: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deploying collection:', error);
        toast.error(formatErrorForToast(error));
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    if (!connected || !mintData.collectionAddress) {
      toast.error('Please connect your wallet and enter a valid collection address');
      return;
    }

    if (!ethers.utils.isAddress(mintData.collectionAddress)) {
      toast.error('Please enter a valid collection address');
      return;
    }

    if (!ethers.utils.isAddress(mintData.recipientAddress)) {
      toast.error('Please enter a valid recipient address');
      return;
    }

    setMintLoading(true);
    try {
      // Create contract instance with ERC1155 ABI
      const { contractABIs } = await import('../contracts/contractABIs');
      const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : null;
      const signer = provider?.getSigner();
      
      if (!signer) {
        throw new Error('No signer available');
      }

      const contract = new ethers.Contract(
        mintData.collectionAddress,
        contractABIs.erc1155Prize,
        signer
      );

      // Call the mint function directly
      const tx = await contract.mint(
        mintData.recipientAddress,
        parseInt(mintData.tokenId),
        parseInt(mintData.amount)
      );

      await tx.wait();
      toast.success(`Successfully minted ${mintData.amount} tokens with ID ${mintData.tokenId} to ${mintData.recipientAddress}`);
      
      // Reset mint form
      setMintData(prev => ({
        ...prev,
        tokenId: '',
        amount: '',
        recipientAddress: ''
      }));
    } catch (error) {
      console.error('Error minting tokens:', error);
        toast.error(formatErrorForToast(error));
    } finally {
      setMintLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to deploy collections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 pb-16">
      <PageContainer className="py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">Deploy ERC1155 Prize Collection</h1>
          <p className="text-muted-foreground text-lg">Create a new ERC1155 collection for raffle prizes</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto mb-8">
          <div className="flex items-center gap-3 mb-5">
            <Package className="h-5 w-5" />
            <h3 className="text-xl font-semibold">Collection Details</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-medium mb-2">Collection Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="My Prize Collection"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Collection Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => handleChange('symbol', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="MPC"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Base URI</label>
                <input
                  type="url"
                  value={formData.baseURI}
                  onChange={(e) => handleChange('baseURI', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="https://api.example.com/metadata/"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Max Supply</label>
                <input
                  type="number"
                  value={formData.maxSupply}
                  onChange={(e) => handleChange('maxSupply', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="1000"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-base font-medium mb-2">Royalty Percentage (0-10%)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.royaltyPercentage}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="5"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                to="/create-raffle"
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-5 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-colors flex items-center justify-center gap-2 text-base h-12"
              >
                <ArrowLeft className="h-5 w-5" />
                Create Raffle
              </Link>
              
              <Button
                type="submit"
                disabled={loading || !connected}
                className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-5 rounded-lg hover:from-green-600 hover:to-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12 flex-1"
              >
                {loading ? 'Deploying...' : 'Deploy Collection'}
              </Button>
            </div>
          </form>
        </div>

        {/* Minting Component */}
        <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <Coins className="h-5 w-5" />
            <h3 className="text-xl font-semibold">Mint Tokens</h3>
          </div>

          <form onSubmit={handleMint} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-base font-medium mb-2">Collection Address</label>
                <input
                  type="text"
                  value={mintData.collectionAddress}
                  onChange={(e) => handleMintChange('collectionAddress', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0x..."
                  required
                />
                {deployedCollection && (
                  <p className="text-sm text-green-600 mt-1">
                    Recently deployed: {deployedCollection}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Token ID</label>
                <input
                  type="number"
                  value={mintData.tokenId}
                  onChange={(e) => handleMintChange('tokenId', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="1"
                  min="0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={mintData.amount}
                  onChange={(e) => handleMintChange('amount', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="100"
                  min="1"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-base font-medium mb-2">Recipient Address</label>
                <input
                  type="text"
                  value={mintData.recipientAddress}
                  onChange={(e) => handleMintChange('recipientAddress', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0x..."
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={mintLoading || !connected || !mintData.collectionAddress}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-5 rounded-lg hover:from-purple-600 hover:to-pink-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12 w-full"
            >
              {mintLoading ? 'Minting...' : 'Mint Tokens'}
            </Button>
          </form>
        </div>
      </PageContainer>
    </div>
  );
};

export default DeployERC1155CollectionPage;