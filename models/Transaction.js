const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "Fund Transfer" },
    status: { type: String, default: "Completed" },
    referenceId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
