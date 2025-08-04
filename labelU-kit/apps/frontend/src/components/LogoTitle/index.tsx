import styled from 'styled-components';
import { useTranslation } from '@labelu/i18n';
import { FlexLayout } from '@labelu/components-react';

import { ReactComponent as Logo } from '@/assets/svg/LOGO.svg';

const Description = styled.span`
  text-align: center;
  color: var(--color-text-secondary);
`;

const LoginLogo = styled(Logo)`
  width: 80px;
  height: 30px;
`;

const LogoTitle = () => {
  const { t } = useTranslation();
  return (
    <FlexLayout flex="column" items="center" gap="1rem">
      <LoginLogo />
      <Description>
        <div>{t('labelUDescription')}</div>
        <div>{t('labelUKeywords')}</div>
      </Description>
    </FlexLayout>
  );
};
export default LogoTitle;
