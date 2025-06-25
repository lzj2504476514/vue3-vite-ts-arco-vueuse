import { Message } from '@arco-design/web-vue'
import { notNullish } from '@antfu/utils'
import Cookies from 'js-cookie'
import type { MaybeRef, UseFetchOptions, UseFetchReturn } from '@vueuse/core'
import { createFetch, isObject } from '@vueuse/core'
import type { LocationQueryRaw } from 'vue-router'
import { stringifyQuery } from 'vue-router'
import { handleCodeError } from '~/api/errorHandler'
import pinia from '~/stores'
import { useSpinStore } from '~/stores/spin'

const spinStore = useSpinStore(pinia)

export interface ApiResponse<T> {
  code?: number
  data?: T
  msg?: string
  success?: boolean
}
let spinList: string[] = []
const whiteList = [1002, 1003, 1004]
const useRequest = createFetch({
  baseUrl: import.meta.env.VITE_BASE_API_URL,
  options: {
    beforeFetch({ options, url }) {
      if (!options.noSpin) {
        spinStore.setSpinVisible(true)
        spinList.push(url)
        spinList = [...new Set(spinList)]
      }
      options.headers = {
        ...options.headers,
        Authorization: Cookies.get('stoken', { domain: import.meta.env.VITE_BASE_URL }) || '',
      }
      return { options }
    },
    async afterFetch({ data, response }) {
      if (spinList.includes(response.url))
        spinStore.setSpinVisible(false)
      // 判断响应是否是json
      const isJson = await response.headers.get('Content-Type')?.includes('application/json')
      if (isJson) {
        if (data?.size < 500) { // 这里size是随便写的 如果是错误消息转的blob会很短 为了兼容消息提示
          const text = await data.text()
          const json = JSON.parse(text)
          handleCodeError(json.code, json.msg)
          data = null
        }
        else {
          const code = data.code
          /** 1002 请修改密码，可跳过 */
          /** 1003 请修改密码，强制 */
          /** 1004 首次登录，请修改密码 */
          // 200、1002、1003、1004不报错，返回code
          const whiteStatus = whiteList.includes(data.code)
          if (whiteStatus) {
            data = notNullish(data.data) ? { ...data.data, code } : { code }
          }
          else if (code === 200) {
            data = notNullish(data.data) ? data.data : {}
          }
          else {
            handleCodeError(data.code, data.msg)
            data = null
          }
        }
      }
      return { data, response }
    },
    onFetchError({ data, error }) {
      spinStore.setSpinVisible(false)
      console.error('onFetchError: ', data, error?.name, error?.message)
      if (error?.name !== 'AbortError')
        Message.error('网络错误，请稍后再试')
      data = undefined
      return { data, error }
    },
  },
  fetchOptions: { mode: 'cors' },
})

/**
 * 封装 get 请求
 * @param url 请求地址
 * @param query 请求参数
 */

export function useGet<T>(
  url: MaybeRef<string>,
  query?: MaybeRef<unknown>,
  useFetchOptions?: UseFetchOptions,
  isJson = true,
): UseFetchReturn<ApiResponse<T>['data'] | Blob> {
  const _url = computed(() => {
    const _url = unref(url)
    const _query = unref(query)
    const queryString = (isObject(_query) ? stringifyQuery(_query as LocationQueryRaw) : _query) || ''
    return `${_url}${queryString ? '?' : ''}${queryString}`
  })
  if (useFetchOptions && useFetchOptions.isFile)
    isJson = false
  if (isJson)
    return useRequest<T>(_url, useFetchOptions || {}).json()
  else
    return useRequest<T>(_url, useFetchOptions || {}).blob()
}

/**
 * 封装 post 请求
 * @param url 请求地址
 * @param payload 请求参数
 */
export function usePost<T>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  useFetchOptions?: UseFetchOptions,
  isJson = true,
): UseFetchReturn<ApiResponse<T>['data'] | Blob> {
  if (useFetchOptions && useFetchOptions.isFile)
    isJson = false
  if (isJson)
    return useRequest<T>(url, useFetchOptions || {}).post(payload).json()
  else
    return useRequest<T>(url, useFetchOptions || {}).post(payload).blob()
}
/**
 * 封装 put 请求
 * @param url 请求地址
 * @param payload 请求参数
 */
export function usePut<T>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  useFetchOptions?: UseFetchOptions,
): UseFetchReturn<ApiResponse<T>['data']> {
  return useRequest<T>(url, useFetchOptions || {}).put(payload).json()
}

/**
 * 封装 delete 请求
 * @param url 请求地址
 * @param payload 请求参数
 */
export function useDelete<T>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  useFetchOptions?: UseFetchOptions,
): UseFetchReturn<ApiResponse<T>['data']> {
  return useRequest<T>(url, useFetchOptions || {}).delete(payload).json()
}
