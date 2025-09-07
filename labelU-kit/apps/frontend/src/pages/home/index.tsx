import { useCallback } from 'react';
import { Button } from 'antd';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  background: linear-gradient(180deg, #f7f8fa 0%, #eef0f3 100%);

  .inner {
    text-align: center;
  }

  h1 {
    font-size: 40px;
    color: #000000;
    margin-bottom: 20px;
  }

  p {
    color: #666;
    margin-bottom: 24px;
  }
  
  .start-btn {
    background: transparent;
    border-color: #000;
    color: #000;
    padding: 16px 40px;
    font-size: 20px;
    font-weight: 600;
    height: auto;
    border-width: 2px;
    border-radius: 10px;
  }
  
  .start-btn:hover,
  .start-btn:focus {
    background: rgba(0,0,0,0.05);
    color: #000;
    border-color: #000;
  }
`;

export default function HomePage() {
  const navigate = useNavigate();
  const handleStart = useCallback(() => {
    navigate('/tasks');
  }, [navigate]);

  return (
    <Wrapper>
      <div className="inner">
        <h1>打造自主可控、先进高效、便捷易用的人工智能数据标注平台</h1>
        <h1>助力集团“人工智能+”高质量发展</h1>

        <Button type="primary" size="large" onClick={handleStart} className="start-btn">
          开始使用
        </Button>
      </div>
    </Wrapper>
  );
}


