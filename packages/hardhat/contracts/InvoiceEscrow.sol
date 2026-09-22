// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20Minimal {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title SaucerPay invoice escrow
/// @notice Creates invoices, accepts native HBAR or Hedera EVM/HTS tokens, and
///         emits a receipt event that can be mirrored or stamped in HCS.
contract InvoiceEscrow {
    enum Status {
        Open,
        Paid,
        Cancelled
    }

    struct Invoice {
        address payable merchant;
        address token; // address(0) means native HBAR; HTS tokens use their EVM address
        uint256 amount;
        uint256 paidAmount;
        uint64 dueAt;
        Status status;
        bytes32 metadataHash;
    }

    uint256 public nextInvoiceId;
    mapping(uint256 => Invoice) public invoices;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed merchant,
        address indexed token,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    );
    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed token,
        uint256 amount,
        bytes32 receiptHash
    );
    event InvoiceCancelled(uint256 indexed invoiceId, address indexed merchant);
    event InvoiceWithdrawn(uint256 indexed invoiceId, address indexed merchant, address indexed token, uint256 amount);

    error NotMerchant();
    error NotOpen();
    error InvalidAmount();
    error WrongPayment();
    error TransferFailed();

    function createInvoice(
        address token,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    ) external returns (uint256 invoiceId) {
        if (amount == 0) revert InvalidAmount();
        invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice(payable(msg.sender), token, amount, 0, dueAt, Status.Open, metadataHash);
        emit InvoiceCreated(invoiceId, msg.sender, token, amount, dueAt, metadataHash);
    }

    function payInvoice(uint256 invoiceId, bytes32 receiptHash) external payable {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.status != Status.Open) revert NotOpen();
        if (invoice.token == address(0)) {
            if (msg.value != invoice.amount) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
            if (!IERC20Minimal(invoice.token).transferFrom(msg.sender, address(this), invoice.amount))
                revert TransferFailed();
        }
        invoice.paidAmount = invoice.amount;
        invoice.status = Status.Paid;
        emit InvoicePaid(invoiceId, msg.sender, invoice.token, invoice.amount, receiptHash);
    }

    function cancelInvoice(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        if (msg.sender != invoice.merchant) revert NotMerchant();
        if (invoice.status != Status.Open) revert NotOpen();
        invoice.status = Status.Cancelled;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    function withdraw(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        if (msg.sender != invoice.merchant) revert NotMerchant();
        if (invoice.status != Status.Paid) revert NotOpen();
        uint256 amount = invoice.paidAmount;
        invoice.paidAmount = 0;
        if (invoice.token == address(0)) {
            (bool ok, ) = invoice.merchant.call{ value: amount }("");
            if (!ok) revert TransferFailed();
        } else if (!IERC20Minimal(invoice.token).transfer(invoice.merchant, amount)) {
            revert TransferFailed();
        }
        emit InvoiceWithdrawn(invoiceId, invoice.merchant, invoice.token, amount);
    }
}
