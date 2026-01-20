import { useCallback, useEffect, useRef, useState } from 'react'

type InfiniteScrollOptions = {
  onLoadMore: () => void
  enabled?: boolean
  rootMargin?: string
}

export const useInfiniteScroll = ({
  onLoadMore,
  enabled = true,
  rootMargin = '200px',
}: InfiniteScrollOptions) => {
  const callbackRef = useRef(onLoadMore)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [isSupported] = useState(() => typeof IntersectionObserver !== 'undefined')

  useEffect(() => {
    callbackRef.current = onLoadMore
  }, [onLoadMore])

  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
  }, [])

  const ref = useCallback(
    (node: Element | null) => {
      disconnect()

      if (!node || !enabled || !isSupported) {
        return
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            callbackRef.current()
          }
        },
        { rootMargin },
      )

      observerRef.current.observe(node)
    },
    [disconnect, enabled, isSupported, rootMargin],
  )

  useEffect(() => disconnect, [disconnect])

  return { ref, isSupported }
}
