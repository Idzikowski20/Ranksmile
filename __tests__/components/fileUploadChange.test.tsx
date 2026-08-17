import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from '../../components/koala/forms/FileUpload';

/**
 * With an image already set the dropzone asked for an upload the user had made, and
 * the preview sat underneath a full-height empty box. It now stands down behind a
 * Change button — organisation logo, workspace logo and profile photo all share this
 * component, so this is the one place the behaviour lives.
 */
describe('FileUpload with an existing image', () => {
  it('hides the dropzone and offers Change', () => {
    render(<FileUpload preview valueUrl="https://example.com/logo.png" label="Upload logo" />);

    expect(screen.queryByText('Upload logo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('brings the dropzone back when Change is pressed', () => {
    render(<FileUpload preview valueUrl="https://example.com/logo.png" label="Upload logo" />);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByText('Upload logo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
    // Change has done its job and would otherwise sit next to the zone it opened.
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('shows the dropzone when there is no image at all', () => {
    render(<FileUpload preview valueUrl={null} label="Upload logo" />);

    expect(screen.getByText('Upload logo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('returns to the dropzone after the image is removed', () => {
    // Controlled the way the settings pages control it: onRemove clears valueUrl.
    function Harness() {
      const [url, setUrl] = React.useState<string | null>('https://example.com/logo.png');
      return <FileUpload preview valueUrl={url} label="Upload logo" onRemove={() => setUrl(null)} />;
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('Upload logo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});
