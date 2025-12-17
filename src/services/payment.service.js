const { VNPay, ProductCode, VnpLocale, dateFormat } = require('vnpay');
const Payment = require("../models/payment.model");
const Order = require("../models/order.model");
const { getIO } = require("../socket/index");

/**
 * Service handling payment operations
 * Integrates with VNPay for payment processing
 */
class PaymentService {

    /**
     * Create VNPay payment URL and save payment record
     * @param {string} orderId - Order ID
     * @param {string} userId - User ID
     * @param {string} ipAddress - Client IP address
     * @returns {Promise<Object>} Payment record with payment URL
     * @throws {Error} If order invalid, unauthorized, or already paid
     */
    async createPaymentUrl(orderId, userId, ipAddress) {
        // Get order details
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found");
        }

        if (order.userId.toString() !== userId.toString()) {
            throw new Error("Unauthorized access to order");
        }

        if (order.paymentMethod !== 'vnpay') {
            throw new Error("Order payment method is not VNPay");
        }

        if (order.paymentStatus === 'paid') {
            throw new Error("Order has already been paid");
        }

        // Initialize VNPay
        const vnpay = new VNPay({
            tmnCode: process.env.VNP_TMNCODE,
            secureSecret: process.env.VNP_HASHSECRET,
            vnpayHost: process.env.VNP_URL || 'https://sandbox.vnpayment.vn',
            testMode: process.env.NODE_ENV !== 'production',
            hashAlgorithm: 'SHA512',
        });

        // Generate unique transaction reference
        const transactionId = `${orderId}_${Date.now()}`;

        // Set expiration time (15 minutes from now)
        const createDate = new Date();
        const expireDate = new Date(createDate.getTime() + 15 * 60 * 1000);

        // Build payment URL
        const paymentUrl = vnpay.buildPaymentUrl({
            vnp_Amount: order.totalAmount,
            vnp_IpAddr: ipAddress,
            vnp_TxnRef: transactionId,
            vnp_OrderInfo: `Thanh toan don hang ${order._id}`,
            vnp_OrderType: ProductCode.Other,
            vnp_ReturnUrl: process.env.VNP_RETURN_URL || `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/vnpay-return`,
            vnp_Locale: VnpLocale.VN,
            vnp_CreateDate: dateFormat(createDate),
            vnp_ExpireDate: dateFormat(expireDate),
        });

        // Save payment record
        const payment = new Payment({
            orderId: order._id,
            userId: order.userId,
            amount: order.totalAmount,
            paymentMethod: 'vnpay',
            status: 'pending',
            transactionId: transactionId,
            paymentUrl: paymentUrl,
        });

        await payment.save();

        return payment;
    }

    /**
     * Verify VNPay return URL callback
     * @param {Object} vnpayParams - VNPay callback parameters
     * @returns {Promise<Object>} Verification result
     * @throws {Error} If signature is invalid
     */
    async verifyReturnUrl(vnpayParams) {
        const vnpay = new VNPay({
            tmnCode: process.env.VNP_TMNCODE,
            secureSecret: process.env.VNP_HASHSECRET,
            vnpayHost: process.env.VNP_URL || 'https://sandbox.vnpayment.vn',
            testMode: process.env.NODE_ENV !== 'production',
            hashAlgorithm: 'SHA512',
        });

        // Verify signature
        const isValid = vnpay.verifyReturnUrl(vnpayParams);
        if (!isValid) {
            throw new Error("Invalid signature");
        }

        const transactionId = vnpayParams.vnp_TxnRef;
        const responseCode = vnpayParams.vnp_ResponseCode;
        const transactionStatus = vnpayParams.vnp_TransactionStatus;

        // Find payment record
        const payment = await Payment.findOne({ transactionId });
        if (!payment) {
            throw new Error("Payment not found");
        }

        // Find order
        const order = await Order.findById(payment.orderId);
        if (!order) {
            throw new Error("Order not found");
        }

        // Check if payment is successful
        const isSuccess = responseCode === '00' && transactionStatus === '00';

        // Update payment status
        payment.status = isSuccess ? 'completed' : 'failed';
        payment.vnpayData = vnpayParams;
        payment.paymentDate = new Date();
        await payment.save();

        // Update order payment status if successful
        if (isSuccess) {
            order.paymentStatus = 'paid';
            order.status = 'confirmed';
            await order.save();

            // Emit socket event to update dashboard
            try {
                const io = getIO();
                io.emit("new_order", {
                    orderId: order._id,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt
                });
            } catch (error) {
                console.error("Socket emit error:", error.message);
            }
        }

        return {
            success: isSuccess,
            payment,
            order,
            message: isSuccess ? 'Payment successful' : 'Payment failed',
        };
    }

    /**
     * Handle VNPay IPN (Instant Payment Notification)
     * @param {Object} vnpayParams - VNPay IPN parameters
     * @returns {Object} IPN response
     */
    async handleIPN(vnpayParams) {
        const vnpay = new VNPay({
            tmnCode: process.env.VNP_TMNCODE,
            secureSecret: process.env.VNP_HASHSECRET,
            vnpayHost: process.env.VNP_URL || 'https://sandbox.vnpayment.vn',
            testMode: process.env.NODE_ENV !== 'production',
            hashAlgorithm: 'SHA512',
        });

        // Verify IPN signature
        const isValid = vnpay.verifyIpnCall(vnpayParams);
        if (!isValid) {
            return {
                RspCode: '97',
                Message: 'Invalid signature',
            };
        }

        const transactionId = vnpayParams.vnp_TxnRef;
        const responseCode = vnpayParams.vnp_ResponseCode;
        const amount = parseInt(vnpayParams.vnp_Amount) / 100;

        // Find payment record
        const payment = await Payment.findOne({ transactionId });
        if (!payment) {
            return {
                RspCode: '01',
                Message: 'Order not found',
            };
        }

        // Check amount
        if (payment.amount !== amount) {
            return {
                RspCode: '04',
                Message: 'Invalid amount',
            };
        }

        // Check if already processed
        if (payment.status === 'completed') {
            return {
                RspCode: '02',
                Message: 'Order already confirmed',
            };
        }

        // Find order
        const order = await Order.findById(payment.orderId);
        if (!order) {
            return {
                RspCode: '01',
                Message: 'Order not found',
            };
        }

        // Process payment
        const isSuccess = responseCode === '00';

        payment.status = isSuccess ? 'completed' : 'failed';
        payment.vnpayData = vnpayParams;
        payment.paymentDate = new Date();
        await payment.save();

        if (isSuccess) {
            order.paymentStatus = 'paid';
            order.status = 'confirmed';
            await order.save();
        }

        return {
            RspCode: '00',
            Message: 'Confirm success',
        };
    }

    /**
     * Get payment by order ID
     * @param {string} orderId - Order ID
     * @returns {Object} Payment record
     */
    async getPaymentByOrderId(orderId) {
        const payment = await Payment.findOne({ orderId })
            .populate('orderId')
            .populate('userId', 'email name');
        return payment;
    }

    /**
     * Get payment by transaction ID
     * @param {string} transactionId - Transaction ID
     * @returns {Object} Payment record
     */
    async getPaymentByTransactionId(transactionId) {
        const payment = await Payment.findOne({ transactionId })
            .populate('orderId')
            .populate('userId', 'email name');
        return payment;
    }
}


module.exports = new PaymentService()