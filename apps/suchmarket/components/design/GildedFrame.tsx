import { ReactNode } from 'react'
import { OrnateCorner } from './OrnateCorner'

interface GildedFrameProps {
  children: ReactNode
  className?: string
  showCorners?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

const paddingMap = {
  sm: 'p-4 md:p-5',
  md: 'p-6 md:p-8',
  lg: 'p-8 md:p-12',
}

export function GildedFrame({
  children,
  className = '',
  showCorners = true,
  padding = 'md',
}: GildedFrameProps) {
  return (
    <div className={`sm-gilded-frame rounded-sm relative ${paddingMap[padding]} ${className}`}>
      {showCorners && (
        <>
          <OrnateCorner className="sm-ornate-corner sm-ornate-corner--tl text-gold" />
          <OrnateCorner className="sm-ornate-corner sm-ornate-corner--tr text-gold" />
          <OrnateCorner className="sm-ornate-corner sm-ornate-corner--bl text-gold" />
          <OrnateCorner className="sm-ornate-corner sm-ornate-corner--br text-gold" />
        </>
      )}
      <div className="relative z-[2]">{children}</div>
    </div>
  )
}
