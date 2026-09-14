/**
 * TTL cho Redis tracking key của order async.
 * Phải đủ dài >= thời gian chịu đựng backlog (message chờ trong queue),
 * nếu không idempotency guard của worker sẽ không tìm thấy tracking khi retry
 * → nguy cơ tạo trùng đơn.
 */
const ORDER_TRACKING_TTL_SECONDS = Number(process.env.ORDER_TRACKING_TTL_SECONDS) || 86400; // 24h

module.exports = { ORDER_TRACKING_TTL_SECONDS };
