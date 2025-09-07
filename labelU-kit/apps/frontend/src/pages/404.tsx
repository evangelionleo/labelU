import styled from 'styled-components';
import { useTranslation } from '@labelu/i18n';

import ongoingPng from '@/assets/svg/ongoing.png';
import Navigate from '@/components/Navigate';

const NotFoundWrapper = styled.div`
  display: flex;
  width: 100vw;
  height: 100vh;
  flex-direction: column;

  .content {
    flex: 1;
    display: flex;
    width: 100%;
    background-color: var(--color-fill-quaternary);
  }

  .inner {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .inner img {
    width: 20%;
    height: auto;
  }
`;

function NotFoundPage() {
  const { t } = (useTranslation as unknown as () => any)();
  return (
    <NotFoundWrapper>
      <Navigate />
      <div className="content">
        <div className="inner">
          <img src={ongoingPng} alt="ongoing" />
          <h3>{t('404notFound')}</h3>
        </div>
      </div>
    </NotFoundWrapper>
  );
}

export default NotFoundPage;
