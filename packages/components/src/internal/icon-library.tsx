/// <reference types="vite-plugin-svgr/client" />
import {
  faBell,
  faClipboard,
  faClock,
  faClone,
  faEye,
  faFileAlt,
  faFolder,
  faFolderOpen,
  faListAlt,
  faTimesCircle,
  IconDefinition,
} from '@fortawesome/free-regular-svg-icons';
import {
  faArrowLeft,
  faArrowRight,
  faBan,
  faCaretDown,
  faChalkboard,
  faCheck,
  faCheckCircle,
  faChevronCircleLeft,
  faCircle,
  faClock as faClockSolid,
  faCloud,
  faCog,
  faCompressArrowsAlt,
  faCreditCard,
  faDownload,
  faEllipsisV,
  faExclamationCircle,
  faExclamationTriangle,
  faExpandArrowsAlt,
  faFileInvoiceDollar,
  faFolder as faFolderSolid,
  faGlobe,
  faGripHorizontal,
  faInfoCircle,
  faLock,
  faLongArrowAltDown,
  faLongArrowAltUp,
  faMinusCircle,
  faMoneyCheckAlt,
  faNewspaper,
  faPause,
  faPen,
  faPlay,
  faPlus,
  faPlusCircle,
  faQuestion,
  faQuestionCircle,
  faRocket,
  faSearch,
  faShareAlt,
  faShieldAlt,
  faSquare as faSquareSolid,
  faStar,
  faSyncAlt,
  faTachometerAlt,
  faTasks,
  faTerminal,
  faTrashAlt,
  faUnlock,
  faVirus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon, FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import _ from 'lodash/fp';
import { FunctionComponent, ReactNode, SVGProps } from 'react';

import { ReactComponent as angleDoubleUp } from './icons/angle-double-up-regular.svg';
import { ReactComponent as angleUp } from './icons/angle-up-regular.svg';
import { ReactComponent as arrowLeftRegular } from './icons/arrow-left-regular.svg';
import { ReactComponent as bars } from './icons/bars-light.svg';
import { ReactComponent as books } from './icons/books-solid.svg';
import { ReactComponent as cardMenuIcon } from './icons/card-menu-icon.svg';
import { ReactComponent as faCloudBolt } from './icons/cloud-compute.svg';
import { ReactComponent as cloudUpload } from './icons/cloud-upload-solid.svg';
import { ReactComponent as columnGrabber } from './icons/column_grabber.svg';
import { ReactComponent as copySolid } from './icons/copy-solid.svg';
import { ReactComponent as downloadRegular } from './icons/download-regular.svg';
import { ReactComponent as externalLinkAlt } from './icons/external-link-alt-regular.svg';
import { ReactComponent as fileExport } from './icons/file-export-regular.svg';
import { ReactComponent as fileSearchSolid } from './icons/file-search-solid.svg';
import { ReactComponent as infoCircleRegular } from './icons/info-circle-regular.svg';
import { ReactComponent as leftCircleFilled } from './icons/left-circle-filled.svg';
import { ReactComponent as list } from './icons/list-regular.svg';
import { ReactComponent as loadingSpinner } from './icons/loading-spinner.svg';
import { ReactComponent as menuIconFilled } from './icons/menu-icon-filled.svg';
import { ReactComponent as minusCircleRed } from './icons/minus-circle-red.svg';
import { ReactComponent as plusCircleFilled } from './icons/plus-circle-filled.svg';
import { ReactComponent as renameIcon } from './icons/rename-icon.svg';
import { ReactComponent as shieldCheckIcon } from './icons/shield-check-solid.svg';
import { ReactComponent as squareLight } from './icons/square-light.svg';
import { ReactComponent as syncAlt } from './icons/sync-alt-regular.svg';
import { ReactComponent as talkBubble } from './icons/talk-bubble.svg';
import { ReactComponent as times } from './icons/times-light.svg';
import { ReactComponent as trashCircleFilled } from './icons/trash-circle-filled.svg';
import { ReactComponent as users } from './icons/users.svg';
import { ReactComponent as warningInfo } from './icons/warning-info.svg';
import { ReactComponent as wdl } from './icons/wdl.svg';

const fa = _.curry((shape: IconDefinition, { size, ...props }: FontAwesomeIconProps) => (
  <FontAwesomeIcon {..._.merge({ icon: shape, style: { height: size, width: size } }, props)} />
));
const custom = _.curry(
  (
    Shape: FunctionComponent<SVGProps<SVGSVGElement>>,
    { size, ...props }: SVGProps<SVGSVGElement> & { size: number }
  ) => <Shape {..._.merge({ 'aria-hidden': true, focusable: false, style: { height: size, width: size } }, props)} />
);

const rotate = _.curry(<P,>(rotation: number, shape: FunctionComponent<P>, props: P) =>
  shape(_.merge({ style: { transform: `rotate(${rotation}deg)` } }, props))
);

const iconLibrary = {
  'angle-down': rotate(180, custom(angleUp)),
  'angle-left': rotate(-90, custom(angleUp)),
  'angle-right': rotate(90, custom(angleUp)),
  'angle-up': custom(angleUp),
  'angle-double-left': rotate(-90, custom(angleDoubleUp)),
  'angle-double-right': rotate(90, custom(angleDoubleUp)),
  arrowLeft: fa(faArrowLeft),
  arrowLeftRegular: custom(arrowLeftRegular),
  arrowRight: fa(faArrowRight),
  ban: fa(faBan),
  bars: custom(bars),
  bell: fa(faBell),
  cardMenuIcon: custom(cardMenuIcon),
  caretDown: fa(faCaretDown),
  chalkboard: fa(faChalkboard),
  check: fa(faCheck),
  circle: fa(faCircle),
  'circle-chevron-left': fa(faChevronCircleLeft),
  clock: fa(faClock),
  clockSolid: fa(faClockSolid),
  cloud: fa(faCloud),
  cloudBolt: custom(faCloudBolt),
  cog: fa(faCog),
  columnGrabber: custom(columnGrabber),
  'compress-arrows-alt': fa(faCompressArrowsAlt),
  copy: fa(faClone),
  copySolid: custom(copySolid),
  'copy-to-clipboard': fa(faClipboard),
  creditCard: fa(faCreditCard),
  download: fa(faDownload),
  downloadRegular: custom(downloadRegular),
  edit: fa(faPen),
  'ellipsis-v': fa(faEllipsisV),
  'ellipsis-v-circle': (props: FontAwesomeIconProps) =>
    fa(faEllipsisV, { mask: faCircle, transform: 'shrink-8', ...props }),
  'error-standard': fa(faExclamationCircle),
  'expand-arrows-alt': fa(faExpandArrowsAlt),
  export: custom(fileExport),
  eye: fa(faEye),
  fileAlt: fa(faFileAlt),
  fileSearchSolid: custom(fileSearchSolid),
  folder: fa(faFolder),
  folderSolid: fa(faFolderSolid),
  'folder-open': fa(faFolderOpen),
  globe: fa(faGlobe),
  help: fa(faQuestionCircle),
  'info-circle': fa(faInfoCircle),
  'info-circle-regular': custom(infoCircleRegular),
  'left-circle-filled': custom(leftCircleFilled),
  library: custom(books),
  listAlt: fa(faListAlt),
  loadingSpinner: custom(loadingSpinner),
  lock: fa(faLock),
  'long-arrow-alt-down': fa(faLongArrowAltDown),
  'long-arrow-alt-up': fa(faLongArrowAltUp),
  'menu-icon-filled': custom(menuIconFilled),
  'minus-circle': fa(faMinusCircle),
  'minus-circle-red': custom(minusCircleRed),
  'money-check-alt': fa(faMoneyCheckAlt),
  newspaper: fa(faNewspaper),
  pause: fa(faPause),
  play: fa(faPlay),
  plus: fa(faPlus),
  'plus-circle': fa(faPlusCircle),
  'plus-circle-filled': custom(plusCircleFilled),
  'lighter-plus-circle': (props: FontAwesomeIconProps) =>
    fa(faPlus, { mask: faCircle, transform: 'shrink-6', ...props }),
  'pop-out': custom(externalLinkAlt),
  purchaseOrder: fa(faFileInvoiceDollar),
  question: fa(faQuestion),
  renameIcon: custom(renameIcon),
  rocket: fa(faRocket),
  search: fa(faSearch),
  share: fa(faShareAlt),
  shield: fa(faShieldAlt),
  shieldCheck: custom(shieldCheckIcon),
  squareLight: custom(squareLight),
  squareSolid: fa(faSquareSolid),
  star: fa(faStar),
  'success-standard': fa(faCheckCircle),
  sync: custom(syncAlt),
  syncAlt: fa(faSyncAlt),
  tachometer: fa(faTachometerAlt),
  tasks: fa(faTasks),
  terminal: (props: FontAwesomeIconProps) => fa(faTerminal, { mask: faSquareSolid, transform: 'shrink-8', ...props }),
  times: custom(times),
  'talk-bubble': custom(talkBubble),
  'times-circle': fa(faTimesCircle),
  trash: fa(faTrashAlt),
  'trash-circle-filled': custom(trashCircleFilled),
  unlock: fa(faUnlock),
  'upload-cloud': custom(cloudUpload),
  users: custom(users),
  'view-cards': fa(faGripHorizontal),
  'view-list': custom(list),
  virus: fa(faVirus),
  'warning-info': custom(warningInfo),
  'warning-standard': fa(faExclamationTriangle),
  wdl: custom(wdl),
};

export type IconId = keyof typeof iconLibrary;

// TODO: Improve types
export default iconLibrary as Record<IconId, (props: any) => ReactNode>;

export const allIconIds = Object.keys(iconLibrary) as IconId[];
