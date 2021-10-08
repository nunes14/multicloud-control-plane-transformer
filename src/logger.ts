import * as winston from "winston";

export const Logger = winston.createLogger({
  level: 'debug',
  transports: [
      new winston.transports.Console({})
  ]
})
