import DialogBox from '@components/DialogBox';
import DialogBoxLabeledItem from '@components/DialogBoxLabeledItem';
import { closeDialog } from '@frontend/dialog';
import { createProject, useAppDispatch } from '@redux/exports';
import React, { useState } from 'react'
import { NavigateFunction, useNavigate } from 'react-router-dom';

export type CreateProjectDialogProps = {
    dialogId: string,
    navigate: NavigateFunction
}
export default function CreateProjectDialog(props: CreateProjectDialogProps) {
    const [projectName,setProjectName] = useState("Test Project")

    const dispatch = useAppDispatch();

    return (<DialogBox onCloseRequest={()=>{
        closeDialog(props.dialogId);
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 500, gap : 20}}>
        <DialogBoxLabeledItem label="Project Name">
            <input type='text' value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder='Name your project' />
        </DialogBoxLabeledItem>
        <div />
        <button onClick={()=>{
          dispatch(
            createProject({
              projectName: projectName,
            })
          ).then((a) => {
            const projectId = a.payload as string;
            props.navigate(`/projects/${projectId}`);
            closeDialog(props.dialogId);
          });
        }} style-border="true">Create</button>
        </div>
        
      </DialogBox>)
}
