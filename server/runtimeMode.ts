export function isDevelopmentMode(args: string[] = process.argv, mode = process.env.NODE_ENV): boolean {
  return args.includes('--dev') || mode === 'development';
}
