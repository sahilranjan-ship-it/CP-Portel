import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AppDataContext, type AppDataContextValue } from './app-data'
import type { AppDataset } from '../types/domain'
import { getAppRepository } from './repository-factory'

export function AppDataProvider({ children }: PropsWithChildren) {
  const [dataset, setDataset] = useState<AppDataset>({
    users: [],
    cps: [],
    leads: [],
    isUpdates: [],
    meetings: [],
    incentives: [],
    sharedConstructionProjects: [],
    barterProjectMatches: [],
    agreements: [],
    vmUpdates: [],
    notifications: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const repository = useMemo(() => getAppRepository(), [])

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const nextDataset = await repository.loadDataset()
      setDataset(nextDataset)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load app data.')
    } finally {
      setIsLoading(false)
    }
  }, [repository])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<AppDataContextValue>(
    () => ({
      dataset,
      isLoading,
      error,
      reload,
      async submitLead(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.submitLead(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to submit lead.')
        } finally {
          setIsLoading(false)
        }
      },
      async createVmLead(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.createVmLead(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to create VM lead.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateIsDisposition(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateIsDisposition(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to save IS update.')
        } finally {
          setIsLoading(false)
        }
      },
      async scheduleMeeting(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.scheduleMeeting(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to save meeting.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateCp(id, input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateCp(id, input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update contractor partner.')
        } finally {
          setIsLoading(false)
        }
      },
      async createCp(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.createCp(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to create contractor partner.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateAgreement(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateAgreement(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update agreement.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateCommercialStage(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateCommercialStage(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update commercial stage.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateCommercialValues(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateCommercialValues(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update commercial values.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateIncentivePayment(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateIncentivePayment(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update incentive payment.')
        } finally {
          setIsLoading(false)
        }
      },
      async updateCpOnboarding(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.updateCpOnboarding(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update CP onboarding.')
        } finally {
          setIsLoading(false)
        }
      },
      async upsertSharedConstructionProject(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.upsertSharedConstructionProject(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update shared construction flow.')
        } finally {
          setIsLoading(false)
        }
      },
      async upsertBarterMatch(input, sessionUser) {
        setIsLoading(true)
        try {
          const nextDataset = await repository.upsertBarterMatch(input, sessionUser)
          setDataset(nextDataset)
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to update barter flow.')
        } finally {
          setIsLoading(false)
        }
      },
      async bulkCreateCp(rows, sessionUser) {
        setIsLoading(true)
        try {
          const res = await repository.bulkCreateCp(rows, sessionUser)
          setDataset(res)
          return res
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to bulk-create contractor partners.')
          throw caughtError
        } finally {
          setIsLoading(false)
        }
      },
    }),
    [dataset, error, isLoading, reload, repository],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
