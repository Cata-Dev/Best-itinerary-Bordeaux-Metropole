enum Providers {
  TBM,
}

function makeMapId<Id extends string | number>(
  idsRanges: Record<Providers, [number, number, number]>,
  idsMappingF: Map<`${Providers}-${Id}`, number>,
  idsMappingB: Map<number, [Id, Providers]>,
) {
  return [
    // Mapper
    (provider: Providers, id: Id): number => {
      const fullId = `${provider}-${id}` as const;
      let mappedId = idsMappingF.get(fullId);
      if (mappedId !== undefined) return mappedId;

      if (idsRanges[provider][2] > idsRanges[provider][1] - idsRanges[provider][0])
        throw new Error(`ID mapping out of range for provider ${provider}`);

      mappedId = idsRanges[provider][0] + ++idsRanges[provider][2];
      idsMappingF.set(fullId, mappedId);
      idsMappingB.set(mappedId, [id, provider]);

      return mappedId;
    },
    // Un-mapper
    (mappedId: number): readonly [Id, Providers] | null => idsMappingB.get(mappedId) ?? null,
  ] as const;
}

export { makeMapId, Providers };
