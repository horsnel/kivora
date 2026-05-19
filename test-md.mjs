import React from 'react';
import ReactMarkdown from 'react-markdown';
import ReactDOMServer from 'react-dom/server';

const md = '```python\nprint("hello")\n```';

function TestApp() {
  return React.createElement(ReactMarkdown, {
    components: {
      pre: (props) => {
        console.log('=== PRE PROPS ===');
        console.log('keys:', Object.keys(props));
        console.log('children type:', typeof props.children);
        if (React.isValidElement(props.children)) {
          console.log('children is React element');
          console.log('children.props keys:', Object.keys(props.children.props));
          console.log('children.props.className:', props.children.props.className);
          console.log('children.props.children:', JSON.stringify(props.children.props.children));
        }
        return React.createElement('pre', null, props.children);
      }
    }
  }, md);
}

const html = ReactDOMServer.renderToString(React.createElement(TestApp));
console.log('HTML:', html.slice(0, 300));
