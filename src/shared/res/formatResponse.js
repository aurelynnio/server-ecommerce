const successResponse = (data, message, code, status = "success") => {
  return {
    status: status,
    message: message,
    code: code,
    data: data,
  };
};

const failResponse = (message, code, status = "fail") => {
  return {
    status: status,
    message: message,
    code: code,
  };
};

const sendSuccess = (res, data, message, code = 200) => {
  res.status(code);
  return res.json(successResponse(data, message, code));
};

const sendFail = (res, message, code) => {
  res.status(code);
  return res.json(failResponse(message, code));
};


module.exports = {
  successResponse,
  failResponse,
  sendSuccess,
  sendFail,
};

