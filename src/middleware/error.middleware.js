export function errorHandler(error, req, res, next) {
  console.error(error);

  res.status(500).json({
    ok: false,
    message: "Internal server error"
  });
}
