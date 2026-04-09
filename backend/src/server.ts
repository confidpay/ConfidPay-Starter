import 'dotenv/config';
import { createServer } from 'node:http';
import { ethers } from 'ethers';
import { ReineiraSDK } from '@reineira-os/sdk';
import { z } from 'zod';

const PORT = process.env.PORT || 3001;
const ADMIN_PRIVATE_KEY = process.env.REINEIRA_ADMIN_PRIVATE_KEY!;
const RPC_URL = process.env.RPC_URL || 'https://arb-sepolia.g.alchemy.com/v2/demo';

if (!ADMIN_PRIVATE_KEY) {
  console.error('REINEIRA_ADMIN_PRIVATE_KEY not set');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

let sdk: ReineiraSDK;

async function initSDK() {
  console.log('Initializing Reineira SDK...');
  sdk = ReineiraSDK.create({
    network: 'testnet',
    signer: wallet,
    provider,
  });
  console.log('SDK initialized successfully');
}

const createEscrowSchema = z.object({
  beneficiary: z.string(),
  amount: z.number().positive(),
});

const fundEscrowSchema = z.object({
  escrowId: z.string(),
  amount: z.number().positive(),
});

function sendJson(res: any, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleCreateEscrow(req: any, res: any) {
  try {
    const body = await parseBody(req);
    const { beneficiary, amount } = createEscrowSchema.parse(body);

    const escrowInstance = await sdk.escrow.create({
      amount: sdk.usdc(amount),
      owner: beneficiary as `0x${string}`,
    });

    sendJson(res, 200, {
      success: true,
      escrowId: escrowInstance.id.toString(),
      txHash: escrowInstance.createTx?.hash,
    });
  } catch (error: any) {
    console.error('Create escrow error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to create escrow' });
  }
}

async function handleFundEscrow(req: any, res: any) {
  try {
    const body = await parseBody(req);
    const { escrowId, amount } = fundEscrowSchema.parse(body);

    const escrowInstance = sdk.escrow.get(BigInt(escrowId));
    const result = await escrowInstance.fund(sdk.usdc(amount), { autoApprove: true });

    sendJson(res, 200, {
      success: true,
      escrowId,
      txHash: result.tx.hash,
    });
  } catch (error: any) {
    console.error('Fund escrow error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to fund escrow' });
  }
}

async function handleRedeemEscrow(req: any, res: any) {
  try {
    const body = await parseBody(req);
    const { escrowId } = z.object({ escrowId: z.string() }).parse(body);

    const escrowInstance = sdk.escrow.get(BigInt(escrowId));
    const result = await escrowInstance.redeem();

    sendJson(res, 200, {
      success: true,
      escrowId,
      txHash: result.hash,
    });
  } catch (error: any) {
    console.error('Redeem escrow error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to redeem escrow' });
  }
}

async function handleGetEscrow(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const escrowId = url.searchParams.get('escrowId');

    if (!escrowId) {
      return sendJson(res, 400, { error: 'Missing escrowId' });
    }

    const exists = await sdk.escrow.exists(BigInt(escrowId));

    if (!exists) {
      return sendJson(res, 200, { success: true, escrow: null });
    }

    const escrowInstance = sdk.escrow.get(BigInt(escrowId));
    const isFunded = await escrowInstance.isFunded();
    const isRedeemable = await escrowInstance.isRedeemable();

    sendJson(res, 200, {
      success: true,
      escrow: {
        escrowId,
        isFunded,
        isRedeemable,
      },
    });
  } catch (error: any) {
    console.error('Get escrow error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get escrow' });
  }
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      resolve(body ? JSON.parse(body) : {});
    });
  });
}

async function main() {
  await initSDK();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (pathname === '/api/escrow' && req.method === 'POST') {
        const action = url.searchParams.get('action');
        if (action === 'create') await handleCreateEscrow(req, res);
        else if (action === 'fund') await handleFundEscrow(req, res);
        else if (action === 'redeem') await handleRedeemEscrow(req, res);
        else sendJson(res, 400, { error: 'Invalid action' });
      } else if (pathname === '/api/escrow' && req.method === 'GET') {
        await handleGetEscrow(req, res);
      } else if (pathname === '/health') {
        sendJson(res, 200, { status: 'ok' });
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (error: any) {
      console.error('Handler error:', error);
      sendJson(res, 500, { error: error.message });
    }
  });

  server.listen(PORT, () => {
    console.log(`\n✅ Backend running at http://localhost:${PORT}`);
    console.log('Routes:');
    console.log('  POST /api/escrow?action=create');
    console.log('  POST /api/escrow?action=fund');
    console.log('  POST /api/escrow?action=redeem');
    console.log('  GET  /api/escrow?escrowId=X');
    console.log('  GET  /health\n');
  });
}

main();
