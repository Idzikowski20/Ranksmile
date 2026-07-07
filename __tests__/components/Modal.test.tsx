import { fireEvent, render, screen } from '@testing-library/react';
import Modal from '../../components/common/Modal';

const closeModalMock = jest.fn();
describe('Modal Component', () => {
   it('Renders without crashing', async () => {
       render(<Modal closeModal={closeModalMock}><div>Modal Body</div></Modal>);
       // Without a title, no close button header is rendered, but the content still shows.
       expect(await screen.findByText('Modal Body')).toBeInTheDocument();
   });
   it('Displays the Given Content', async () => {
      render(<Modal closeModal={closeModalMock}>
        <div>
           <h1>Hello Modal!!</h1>
        </div>
      </Modal>);
      expect(await screen.findByText('Hello Modal!!')).toBeInTheDocument();
   });
   it('Renders Modal Title', async () => {
      render(<Modal closeModal={closeModalMock} title="Sample Modal Title"><p>Some Modal Content</p></Modal>);
      expect(await screen.findByText('Sample Modal Title')).toBeInTheDocument();
   });
   it('Closes the modal on close button click', async () => {
      render(<Modal closeModal={closeModalMock} title="Sample Modal Title"><p>Some Modal Content</p></Modal>);
      const closeBtn = await screen.findByRole('button', { name: /close modal/i });
      fireEvent.click(closeBtn);
      expect(closeModalMock).toHaveBeenCalled();
   });
});
