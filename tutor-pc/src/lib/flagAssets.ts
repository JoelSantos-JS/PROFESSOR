import br from 'flag-icons/flags/4x3/br.svg'
import cn from 'flag-icons/flags/4x3/cn.svg'
import de from 'flag-icons/flags/4x3/de.svg'
import es from 'flag-icons/flags/4x3/es.svg'
import fr from 'flag-icons/flags/4x3/fr.svg'
import gb from 'flag-icons/flags/4x3/gb.svg'
import id from 'flag-icons/flags/4x3/id.svg'
import it from 'flag-icons/flags/4x3/it.svg'
import jp from 'flag-icons/flags/4x3/jp.svg'
import kr from 'flag-icons/flags/4x3/kr.svg'
import nl from 'flag-icons/flags/4x3/nl.svg'
import pl from 'flag-icons/flags/4x3/pl.svg'
import ru from 'flag-icons/flags/4x3/ru.svg'
import sa from 'flag-icons/flags/4x3/sa.svg'
import th from 'flag-icons/flags/4x3/th.svg'
import tr from 'flag-icons/flags/4x3/tr.svg'
import vn from 'flag-icons/flags/4x3/vn.svg'
import inFlag from 'flag-icons/flags/4x3/in.svg'

const FLAG_ASSETS: Record<string, string> = {
  br,
  cn,
  de,
  es,
  fr,
  gb,
  id,
  in: inFlag,
  it,
  jp,
  kr,
  nl,
  pl,
  ru,
  sa,
  th,
  tr,
  vn,
}

export function flagAssetForCountry(country: string | null): string | null {
  if (!country) return null
  return FLAG_ASSETS[country] ?? null
}
