export function lowerFirst(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

export function entityFieldNames(typeName: string, serviceName: string) {
  const singular = lowerFirst(typeName);
  return {
    list: serviceName,
    one: singular,
    count: `${serviceName}Count`,
    byId: `${singular}ById`,
    save: `save${typeName}`,
    delete: `delete${typeName}`,
    batchSave: `batchSave${typeName}`,
    batchDelete: `batchDelete${typeName}`,
  };
}
