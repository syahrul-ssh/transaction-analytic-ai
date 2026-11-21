type Environment = Record<string, unknown>;

const requiredVariables = [
  'APP_NAME',
  'PORT',
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
];

function validateInteger(
  config: Environment,
  key: string,
  defaultValue?: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const value = config[key] ?? defaultValue;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `${key} must be an integer between ${min} and ${max}`,
    );
  }

  return parsed;
}

export function validateEnv(
  config: Environment,
): Record<string, any> {
  const missing = requiredVariables.filter(
    (key) => config[key] === undefined || config[key] === '',
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}`,
    );
  }

  const nodeEnv = config.NODE_ENV ?? 'development';

  const allowedEnvironments = [
    'development',
    'production',
    'test',
  ];

  if (!allowedEnvironments.includes(String(nodeEnv))) {
    throw new Error(
      `NODE_ENV must be one of: ${allowedEnvironments.join(', ')}`,
    );
  }

  config.NODE_ENV = nodeEnv;

  config.PORT = validateInteger(
    config,
    'PORT',
    3000,
    1,
    65535,
  );

  config.DATABASE_PORT = validateInteger(
    config,
    'DATABASE_PORT',
    5432,
    1,
    65535,
  );

  config.REDIS_PORT = validateInteger(
    config,
    'REDIS_PORT',
    6379,
    1,
    65535,
  );

  config.REDIS_DB = validateInteger(
    config,
    'REDIS_DB',
    0,
    0,
    15,
  );

  config.REDIS_HOST ??= 'localhost';
  config.REDIS_PASSWORD ??= '';

  return config as Record<string, any>;
}