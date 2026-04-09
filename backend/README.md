# ConfidPay Backend

Standalone backend for ReineiraOS SDK operations.

## Setup

```bash
cd backend
npm install
```

## Configure

Create `.env` file:
```
REINEIRA_ADMIN_PRIVATE_KEY=your_private_key
RPC_URL=https://arb-sepolia.g.alchemy.com/v2/demo
PORT=3001
```

## Run

```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/escrow?action=create` | Create escrow |
| POST | `/api/escrow?action=fund` | Fund escrow |
| POST | `/api/escrow?action=redeem` | Redeem escrow |
| GET | `/api/escrow?escrowId=X` | Get escrow info |
| GET | `/health` | Health check |

## Request/Response Examples

### Create Escrow
```bash
curl -X POST http://localhost:3001/api/escrow?action=create \
  -H "Content-Type: application/json" \
  -d '{"beneficiary": "0x...", "amount": 1000}'
```

### Response
```json
{
  "success": true,
  "escrowId": "123",
  "txHash": "0x..."
}
```

## Deploy to Vercel

1. Create a new Vercel project
2. Set root directory to `backend`
3. Add environment variables
4. Deploy

```bash
vercel --prod
```
