import { GenericContractsDeclaration } from "~~/utils/scaffold-hbar/contract";

const deployedContracts = {
  296: {
    InvoiceEscrow: {
      address: "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3",
      deployedOnBlock: 1,
      abi: [
        { type: "error", name: "NotMerchant", inputs: [] },
        { type: "error", name: "NotOpen", inputs: [] },
        { type: "error", name: "InvalidAmount", inputs: [] },
        { type: "error", name: "WrongPayment", inputs: [] },
        { type: "error", name: "TransferFailed", inputs: [] },
        {
          type: "function",
          name: "createInvoice",
          stateMutability: "nonpayable",
          inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "dueAt", type: "uint64" },
            { name: "metadataHash", type: "bytes32" },
          ],
          outputs: [{ name: "invoiceId", type: "uint256" }],
        },
        {
          type: "function",
          name: "payInvoice",
          stateMutability: "payable",
          inputs: [
            { name: "invoiceId", type: "uint256" },
            { name: "receiptHash", type: "bytes32" },
          ],
          outputs: [],
        },
        {
          type: "function",
          name: "withdraw",
          stateMutability: "nonpayable",
          inputs: [{ name: "invoiceId", type: "uint256" }],
          outputs: [],
        },
        {
          type: "function",
          name: "cancelInvoice",
          stateMutability: "nonpayable",
          inputs: [{ name: "invoiceId", type: "uint256" }],
          outputs: [],
        },
        {
          type: "function",
          name: "nextInvoiceId",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "invoices",
          stateMutability: "view",
          inputs: [{ name: "", type: "uint256" }],
          outputs: [
            { name: "merchant", type: "address" },
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "paidAmount", type: "uint256" },
            { name: "dueAt", type: "uint64" },
            { name: "status", type: "uint8" },
            { name: "metadataHash", type: "bytes32" },
          ],
        },
        {
          type: "event",
          name: "InvoiceCreated",
          anonymous: false,
          inputs: [
            { indexed: true, name: "invoiceId", type: "uint256" },
            { indexed: true, name: "merchant", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
            { indexed: false, name: "dueAt", type: "uint64" },
            { indexed: false, name: "metadataHash", type: "bytes32" },
          ],
        },
        {
          type: "event",
          name: "InvoicePaid",
          anonymous: false,
          inputs: [
            { indexed: true, name: "invoiceId", type: "uint256" },
            { indexed: true, name: "payer", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
            { indexed: false, name: "receiptHash", type: "bytes32" },
          ],
        },
        {
          type: "event",
          name: "InvoiceCancelled",
          anonymous: false,
          inputs: [
            { indexed: true, name: "invoiceId", type: "uint256" },
            { indexed: true, name: "merchant", type: "address" },
          ],
        },
        {
          type: "event",
          name: "InvoiceWithdrawn",
          anonymous: false,
          inputs: [
            { indexed: true, name: "invoiceId", type: "uint256" },
            { indexed: true, name: "merchant", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
          ],
        },
      ],
    },
  },
} as const satisfies GenericContractsDeclaration;

export default deployedContracts;
