export function notNull<T>(value: T | undefined | null): value is T {
  return value != null;
}

export function fromEntries(entries: [string, any][]) {
  return entries.reduce<{ [key: string]: any }>((accu, [key, value]) => {
    accu[key] = value;
    return accu;
  }, {});
}
