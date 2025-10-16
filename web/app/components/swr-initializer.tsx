'use client'

import { SWRConfig } from 'swr'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { fetchSetupStatus } from '@/service/common'
import {
  EDUCATION_VERIFYING_LOCALSTORAGE_ITEM,
  EDUCATION_VERIFY_URL_SEARCHPARAMS_ACTION,
} from '@/app/education-apply/constants'
import { resolvePostLoginRedirect } from '../signin/utils/post-login-redirect'

type SwrInitializerProps = {
  children: ReactNode
}
const SwrInitializer = ({
  children,
}: SwrInitializerProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const consoleToken = decodeURIComponent(searchParams.get('access_token') || '')
  const refreshToken = decodeURIComponent(searchParams.get('refresh_token') || '')
  const consoleTokenFromLocalStorage = localStorage?.getItem('console_token')
  const refreshTokenFromLocalStorage = localStorage?.getItem('refresh_token')
  const pathname = usePathname()
  const [init, setInit] = useState(false)

  const isSetupFinished = useCallback(async () => {
    try {
      if (localStorage.getItem('setup_status') === 'finished')
        return true
      const setUpStatus = await fetchSetupStatus()
      if (setUpStatus.step !== 'finished') {
        localStorage.removeItem('setup_status')
        return false
      }
      localStorage.setItem('setup_status', 'finished')
      return true
    }
    catch (error) {
      console.error(error)
      return false
    }
  }, [])

  useEffect(() => {
    (async () => {
      const action = searchParams.get('action')

      if (action === EDUCATION_VERIFY_URL_SEARCHPARAMS_ACTION)
        localStorage.setItem(EDUCATION_VERIFYING_LOCALSTORAGE_ITEM, 'yes')

      try {
        const isFinished = await isSetupFinished()
        if (!isFinished) {
          router.replace('/install')
          return
        }
        if (!((consoleToken && refreshToken) || (consoleTokenFromLocalStorage && refreshTokenFromLocalStorage))) {
          const sfToken = decodeURIComponent(searchParams.get('sf_token') || '') || localStorage.getItem('accessToken')
          if (sfToken) {
            router.replace(`/sf-oauth-callback?sf_token=${sfToken}&redirect_url=${pathname}`)
            return
          }
          router.replace('/signin')
          return
        }
        if (searchParams.has('access_token') || searchParams.has('refresh_token')) {
          consoleToken && localStorage.setItem('console_token', consoleToken)
          refreshToken && localStorage.setItem('refresh_token', refreshToken)
          const redirectUrl = resolvePostLoginRedirect(searchParams)
          if (redirectUrl)
            location.replace(redirectUrl)
          else
            router.replace(pathname)
        }
        if (searchParams.has('sf_token')) { // 如果本地存在登录信息 链接带sf_token 使用sf_token登录
          const sfToken = decodeURIComponent(searchParams.get('sf_token') || '')
          router.replace(`/sf-oauth-callback?sf_token=${sfToken}&redirect_url=${pathname}`)
          return
        }
        setInit(true)
      }
      catch {
        router.replace('/signin')
      }
    })()
  }, [isSetupFinished, router, pathname, searchParams, consoleToken, refreshToken, consoleTokenFromLocalStorage, refreshTokenFromLocalStorage])

  return init
    ? (
      <SWRConfig value={{
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        dedupingInterval: 60000,
        focusThrottleInterval: 5000,
        provider: () => new Map(),
      }}>
        {children}
      </SWRConfig>
    )
    : null
}

export default SwrInitializer
