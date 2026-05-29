using UnityEngine;

public class OrbitCamera : MonoBehaviour
{
    public Transform target;
    public float distance   = 5f;
    public float rotateSpeed = 3f;
    public float panSpeed    = 0.3f;
    public float zoomSpeed   = 2f;
    public float minDistance = 1f;
    public float maxDistance = 20f;

    private float angleX = 0f;
    private float angleY = 20f;

    void Update()
    {
        // Rotate — left mouse drag
        if (Input.GetMouseButton(0))
        {
            angleX += Input.GetAxis("Mouse X") * rotateSpeed;
            angleY -= Input.GetAxis("Mouse Y") * rotateSpeed;
            angleY  = Mathf.Clamp(angleY, -80f, 80f);
        }

        // Pan — right mouse drag
        if (Input.GetMouseButton(1))
        {
            Vector3 right = transform.right * (-Input.GetAxis("Mouse X") * panSpeed);
            Vector3 up    = transform.up    * (-Input.GetAxis("Mouse Y") * panSpeed);
            if (target != null) target.position += right + up;
        }

        // Zoom — scroll wheel
        float scroll = Input.GetAxis("Mouse ScrollWheel");
        distance = Mathf.Clamp(distance - scroll * zoomSpeed * 10f, minDistance, maxDistance);

        // Apply
        Quaternion rot    = Quaternion.Euler(angleY, angleX, 0);
        Vector3   pivot   = target != null ? target.position : Vector3.zero;
        transform.position = rot * new Vector3(0, 0, -distance) + pivot;
        transform.rotation = rot;
    }
}
