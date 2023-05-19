import { makeObservable, observable, runInAction } from 'mobx';

type StringOrNumberValueKey<EntityType> = 0 extends EntityType & 1
  ? any
  : EntityType extends object
    ? {
      [Property in keyof EntityType]-?: EntityType[Property] extends number | string ? Property : never;
    }[keyof EntityType]
    : never;

type GetOption = {
  useCache?: boolean;
};

export class AsyncEntityService<
  EntityType,
  PrimaryKey extends StringOrNumberValueKey<EntityType>,
  ParamsType extends object,
> {
  private readonly _primaryKey: PrimaryKey;

  private readonly _fetchEntityByPrimaryKey;

  cachedEntityMap: Map<EntityType[PrimaryKey], EntityType> = new Map();

  _primaryKeyFetcherMap: Map<EntityType[PrimaryKey], Promise<EntityType>> = new Map();

  asyncGetEntityByPrimaryKey = (primaryKeyValue: EntityType[PrimaryKey], option?: GetOption): Promise<EntityType> => {
    const useCache = !!option?.useCache;

    if (useCache && this.cachedEntityMap.has(primaryKeyValue)) {
      return Promise.resolve(this.cachedEntityMap.get(primaryKeyValue));
    }

    if (useCache && this._primaryKeyFetcherMap.has(primaryKeyValue)) {
      return this._primaryKeyFetcherMap.get(primaryKeyValue);
    }

    const fetcherPromise = new Promise<EntityType>((resolve) => {
      this._fetchEntityByPrimaryKey(primaryKeyValue).then((entity) => {
        if (entity) {
          runInAction(() => {
            this.cachedEntityMap.set(primaryKeyValue, entity);
            this._primaryKeyFetcherMap.delete(primaryKeyValue);
          });
        }
        resolve(entity);
      });
    });
    runInAction(() => {
      this._primaryKeyFetcherMap.set(primaryKeyValue, fetcherPromise);
    });

    return fetcherPromise;
  };

  getEntityByPrimaryKey = (primaryKeyValue: EntityType[PrimaryKey]): EntityType => {
    if (!this.cachedEntityMap.has(primaryKeyValue)) {
      this.asyncGetEntityByPrimaryKey(primaryKeyValue, { useCache: true });
    }

    return this.cachedEntityMap.get(primaryKeyValue);
  };

  private readonly _fetchEntitiesByParams;

  cachedParamsEntitiesMap: Map<string, EntityType[]> = new Map();

  _paramsFetcherMap: Map<string, Promise<EntityType[]>> = new Map();

  asyncGetEntitiesByParams;

  getEntitiesByParams;

  constructor(
    primaryKey: PrimaryKey,
    fetchEntityByPrimaryKey: (primaryKey: EntityType[PrimaryKey]) => Promise<EntityType>,
    fetchEntitiesByParams?: (params: ParamsType) => Promise<EntityType[]>,
  ) {
    this._primaryKey = primaryKey;

    this._fetchEntityByPrimaryKey = fetchEntityByPrimaryKey;

    if (typeof fetchEntitiesByParams === 'function') {
      this._fetchEntitiesByParams = fetchEntitiesByParams;

      this.asyncGetEntitiesByParams = (params: ParamsType, option?: GetOption): Promise<EntityType[]> => {
        const useCache = !!option?.useCache;
        const cacheKey = JSON.stringify(params);

        if (useCache && this.cachedParamsEntitiesMap.has(cacheKey)) {
          return Promise.resolve(this.cachedParamsEntitiesMap.get(cacheKey));
        }

        if (useCache && this._paramsFetcherMap.has(cacheKey)) {
          return this._paramsFetcherMap.get(cacheKey);
        }

        const fetcherPromise = new Promise<EntityType[]>((resolve) => {
          this._fetchEntitiesByParams(params).then((entities) => {
            if (entities?.length) {
              runInAction(() => {
                for (const entity of entities) {
                  this.cachedEntityMap.set(entity[this._primaryKey], entity);
                }
                this.cachedParamsEntitiesMap.set(cacheKey, entities);
                this._paramsFetcherMap.delete(cacheKey);
              });
            }
            resolve(entities);
          });
        });
        runInAction(() => {
          this._paramsFetcherMap.set(cacheKey, fetcherPromise);
        });

        return fetcherPromise;
      };

      this.getEntitiesByParams = (params: ParamsType): EntityType[] => {
        const cacheKey = JSON.stringify(params);

        if (!this.cachedParamsEntitiesMap.has(cacheKey)) {
          this.asyncGetEntitiesByParams(params, { useCache: true });
        }

        return this.cachedParamsEntitiesMap.get(cacheKey);
      };
    }

    makeObservable(this, {
      cachedEntityMap: observable,
      _primaryKeyFetcherMap: observable,
      _paramsFetcherMap: observable,
    });
  }
}
