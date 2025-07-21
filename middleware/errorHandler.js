 const mongoose = require('mongoose');
 
 // Custom error classes
 class AppError extends Error {
   constructor(message, statusCode) {
     super(message);
     this.statusCode = statusCode;
     this.isOperational = true;
 
     Error.captureStackTrace(this, this.constructor);
   }
 }
 
 class ValidationError extends AppError {
   constructor(message) {
     super(message, 400);
     this.name = 'ValidationError';
   }
 }
 
 class AuthenticationError extends AppError {
   constructor(message = 'Authentication failed') {
     super(message, 401);
     this.name = 'AuthenticationError';
   }
 }
 
 class AuthorizationError extends AppError {
   constructor(message = 'Access denied') {
     super(message, 403);
     this.name = 'AuthorizationError';
   }
 }
 
 class NotFoundError extends AppError {
   constructor(message = 'Resource not found') {
     super(message, 404);
     this.name = 'NotFoundError';
   }
 }
 
 // Handle specific MongoDB errors
 const handleCastErrorDB = (err) => {
   const message = `Invalid ${err.path}: ${err.value}`;
   return new ValidationError(message);
 };
 
 const handleDuplicateFieldsDB = (err) => {
   const field = Object.keys(err.keyValue)[0];
   const value = err.keyValue[field];
   const message = `Duplicate value for field '${field}': ${value}. Please use another value.`;
   return new ValidationError(message);
 };
 
 const handleValidationErrorDB = (err) => {
   const errors = Object.values(err.errors).map(el => el.message);
   const message = `Invalid input data: ${errors.join('. ')}`;
   return new ValidationError(message);
 };
 
 const handleJWTError = () => {
   return new AuthenticationError('Invalid token. Please log in again.');
 };
 
 const handleJWTExpiredError = () => {
   return new AuthenticationError('Your token has expired. Please log in again.');
 };
 
 // Send error response in development
 const sendErrorDev = (err, reply) => {
   reply.code(err.statusCode || 500).send({
     success: false,
     error: {
       message: err.message,
       stack: err.stack,
       name: err.name,
       statusCode: err.statusCode,
       ...err
     }
   });
 };
 
 // Send error response in production
 const sendErrorProd = (err, reply) => {
   // Operational, trusted error: send message to client
   if (err.isOperational) {
     reply.code(err.statusCode).send({
       success: false,
       error: {
         message: err.message,
         statusCode: err.statusCode
       }
     });
   } else {
     // Programming or other unknown error: don't leak error details
     console.error('ERROR 💥', err);
     
     reply.code(500).send({
       success: false,
       error: {
         message: err.message || 'Something went wrong!',
         statusCode: 500
       }
     });
   }
 };
 
 // Main error handler
 const errorHandler = (error, request, reply) => {
   let err = { ...error };
   err.message = error.message;
   err.statusCode = error.statusCode || 500;
 
   // Log error
   request.log.error({
     error: {
       message: err.message,
       stack: err.stack,
       statusCode: err.statusCode
     },
     request: {
       method: request.method,
       url: request.url,
       headers: request.headers,
       body: request.body
     }
   });
 
   // Handle specific error types
   if (error.name === 'CastError') err = handleCastErrorDB(err);
   if (error.code === 11000) err = handleDuplicateFieldsDB(err);
   if (error.name === 'ValidationError') err = handleValidationErrorDB(err);
   if (error.name === 'JsonWebTokenError') err = handleJWTError();
   if (error.name === 'TokenExpiredError') err = handleJWTExpiredError();
 
   // Handle Mongoose validation errors
   if (error instanceof mongoose.Error.ValidationError) {
     const errors = Object.values(error.errors).map(val => val.message);
     err = new ValidationError(`Validation Error: ${errors.join(', ')}`);
   }
 
   // Handle Mongoose CastError
   if (error instanceof mongoose.Error.CastError) {
     err = new ValidationError(`Invalid ${error.path}: ${error.value}`);
   }
 
   // Handle Fastify validation errors
   if (error.validation) {
     const message = error.validation.map(v => `${v.instancePath} ${v.message}`).join(', ');
     err = new ValidationError(`Validation Error: ${message}`);
   }
 
   // Send appropriate error response based on environment
   if (process.env.NODE_ENV === 'development') {
     sendErrorDev(err, reply);
   } else {
     sendErrorProd(err, reply);
   }
 };
 
 // Async error wrapper
 const catchAsync = (fn) => {
   return async (request, reply) => {
     try {
       await fn(request, reply);
     } catch (error) {
       reply.send(error);
     }
   };
 };
 
 // Not found handler
 const notFoundHandler = (request, reply) => {
   reply.code(404).send({
     success: false,
     error: {
       message: `Route ${request.method}:${request.url} not found`,
       statusCode: 404
     }
   });
 };
 
 module.exports = {
   errorHandler,
   catchAsync,
   notFoundHandler,
   AppError,
   ValidationError,
   AuthenticationError,
   AuthorizationError,
   NotFoundError
 };