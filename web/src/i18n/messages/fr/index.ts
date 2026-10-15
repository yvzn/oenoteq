import cellar from './cellar'
import common from './common'
import consent from './consent'
import manage from './manage'
import offline from './offline'
import storage from './storage'

export default { ...cellar, ...common, ...consent, ...manage, ...offline, ...storage }
